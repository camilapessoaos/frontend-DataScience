(function(){
  "use strict";
  
  const API_BASE_URL = "http://localhost:8000";
  const ENDPOINTS = {
    root:    () => `${API_BASE_URL}/`,
    predict: () => `${API_BASE_URL}/prever`,
    history: () => `${API_BASE_URL}/predicoes`,
  };

  let backendAvailable = false;
  let demoHistory = [];
  let chartDist = null; // guarda o gráfico para poder destruir antes de recriar

  const NUMERIC_INT_FIELDS = ["idade", "nivel_estresse", "nivel_vicio"];
  const NUMERIC_FLOAT_FIELDS = [
    "horas_diarias_redes_sociais", "horas_sono", "tempo_tela_antes_dormir",
    "desempenho_academico", "atividade_fisica"
  ];

   const STRING_FIELDS = ["genero", "uso_plataforma", "nivel_interacao_social"];


  const GENDER_LABELS = { "M": "Masculino", "F": "Feminino", "1": "Masculino", "2": "Feminino" };


  const form = document.getElementById("predictionForm");
  const submitBtn = document.getElementById("submitBtn");
  const resultEmpty = document.getElementById("resultEmpty");
  const resultContent = document.getElementById("resultContent");
  const gaugeBlock = document.getElementById("gaugeBlock");
  const iconBlock = document.getElementById("iconBlock");
  const iconLow = document.getElementById("iconLow");
  const iconHigh = document.getElementById("iconHigh");
  const probValueEl = document.getElementById("probValue");
  const gaugeArc = document.getElementById("gaugeArc");
  const resultBadge = document.getElementById("resultBadge");
  const resultLabel = document.getElementById("resultLabel");
  const resultNote = document.getElementById("resultNote");
  const statusBanner = document.getElementById("statusBanner");
  const statusText = document.getElementById("statusText");
  const historyBody = document.getElementById("historyTableBody");
  const historyEmpty = document.getElementById("historyEmpty");
  const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

  // ---- sliders com leitura em tempo real ----
  ["nivel_estresse", "nivel_vicio"].forEach((id) => {
    const input = document.getElementById(id);
    const out = document.getElementById(id + "_val");
    input.addEventListener("input", () => { out.textContent = input.value; });
  });


  function buildPayload(){
    const payload = {};
    NUMERIC_INT_FIELDS.forEach((id) => {
      payload[id] = parseInt(document.getElementById(id).value, 10);
    });
    NUMERIC_FLOAT_FIELDS.forEach((id) => {
      payload[id] = parseFloat(document.getElementById(id).value);
    });
    STRING_FIELDS.forEach((id) => {
      payload[id] = document.getElementById(id).value;
    });
    return payload;
  }


  async function checkBackend(){
    try{
      const res = await fetch(ENDPOINTS.root());
      backendAvailable = res.ok;
    }catch(e){
      backendAvailable = false;
    }
    updateStatusBanner();
    loadHistory();
  }

  function updateStatusBanner(){
    if(backendAvailable){
      statusBanner.classList.add("connected");
      statusText.textContent = "Conectado à API de predição";
    }else{
      statusBanner.classList.remove("connected");
      statusText.textContent = "Pré-visualização sem back-end — exibindo dados de demonstração";
    }
  }

  // ---- fallback local, usado só enquanto o back-end não está acessível ----
  // Heurística simples e transparente, apenas para ver o front funcionando
  // ponta-a-ponta. NÃO é o modelo real (SVM treinado em Python).
  function mockPredict(payload){
    const score =
      (payload.nivel_estresse / 10) * 0.30 +
      (payload.nivel_vicio / 10) * 0.30 +
      (payload.tempo_tela_antes_dormir / 6) * 0.15 +
      (1 - payload.horas_sono / 12) * 0.15 +
      (payload.horas_diarias_redes_sociais / 16) * 0.10;
    const probability = Math.min(0.97, Math.max(0.03, score));
    return {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      prediction: probability > 0.5 ? 1 : 0,
      probability: probability,
      ...payload
    };
  }

  
  

  function renderResult(result){
    resultEmpty.classList.add("is-hidden");
    resultContent.classList.remove("is-hidden");

    const hasProbability = typeof result.probability === "number";
    const isHigh = result.prediction === 1;

    gaugeBlock.classList.toggle("is-hidden", !hasProbability);
    iconBlock.classList.toggle("is-hidden", hasProbability);

    if(hasProbability){
      const pct = Math.round(result.probability * 100);
      probValueEl.textContent = pct;
      const circumference = 282.7; // comprimento aproximado do arco do SVG
      const offset = circumference - (circumference * (pct / 100));
      gaugeArc.style.transition = "stroke-dashoffset .6s ease";
      gaugeArc.setAttribute("stroke-dashoffset", offset.toString());
    }else{
      iconLow.classList.toggle("is-hidden", isHigh);
      iconHigh.classList.toggle("is-hidden", !isHigh);
    }

    resultBadge.classList.toggle("high", isHigh);
    resultBadge.classList.toggle("low", !isHigh);
    resultLabel.textContent = isHigh ? "Alto risco de ansiedade" : "Baixo risco de ansiedade";

    resultNote.textContent = hasProbability
      ? "Estimativa calculada localmente apenas para demonstração (back-end não conectado)."
      : "Resultado calculado pelo modelo treinado (SVM) a partir dos dados informados.";
  }

  function genderLabel(code){ return GENDER_LABELS[String(code)] || "—"; }

  function formatTimestamp(ts){
    if(!ts) return "—";
    try{
      const iso = (ts.includes(" ") && !ts.includes("T")) ? ts.replace(" ", "T") : ts;
      const d = new Date(iso);
      if(isNaN(d.getTime())) return ts;
      return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    }catch(e){ return ts; }
  }


  function normalizeHistoryRecord(item){
    return {
      id: item.id,
      timestamp: item.data_hora,
      prediction: item.predicao_ansiedade_alta,
      ...(item.dados_entrada || {})
    };
  }

  function buildHistoryRow(record){
    const tr = document.createElement("tr");
    const isHigh = record.prediction === 1;
    tr.innerHTML = `
      <td class="mono">${formatTimestamp(record.timestamp)}</td>
      <td>${record.idade ?? "—"}</td>
      <td>${genderLabel(record.genero)}</td>
      <td>${record.nivel_estresse ?? "—"}</td>
      <td>${record.nivel_vicio ?? "—"}</td>
      <td><span class="badge-sm ${isHigh ? "high" : "low"}">${isHigh ? "Alto" : "Baixo"}</span></td>
    `;
    return tr;
  }

  function renderCharts(records){
    const section = document.getElementById("dashboardSection");

    // sem dados, mantém o dashboard oculto
    if(!records || records.length === 0){ section.style.display = "none"; return; }
    section.style.display = "block";

    // conta quantas predições foram alto e baixo risco
    const high = records.filter(r => r.prediction === 1).length;
    const low = records.length - high;

    // evita empilhar gráficos no mesmo canvas ao atualizar
    if(chartDist) chartDist.destroy();

    chartDist = new Chart(document.getElementById("chartDist"), {
      type: "doughnut",
      data: {
        labels: ["Baixo risco", "Alto risco"],
        datasets: [{ data: [low, high], backgroundColor: ["#A3C13F", "#BA8B5C"], borderWidth: 0 }]
      },
      options: { cutout: "65%", plugins: { legend: { position: "bottom" } } }
    });
  }

  function renderHistory(records){
    historyBody.innerHTML = "";
    if(!records || records.length === 0){
      historyEmpty.style.display = "block";
      return;
    }
    historyEmpty.style.display = "none";
    records.forEach((r) => historyBody.appendChild(buildHistoryRow(r)));
    renderCharts(records); // atualiza o gráfico junto com o histórico
  }


  async function loadHistory(){
    if(backendAvailable){
      try{
        const res = await fetch(ENDPOINTS.history());
        const data = await res.json();
        const records = (data.predicoes || []).map(normalizeHistoryRecord).reverse(); // mais recente primeiro
        renderHistory(records);
        return;
      }catch(e){
        console.warn("Falha ao buscar histórico da API, usando dados locais.", e);
      }
    }
    renderHistory(demoHistory);
  }

  // ---- envio do formulário ----
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if(!form.checkValidity()){
      form.reportValidity();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Calculando…";

    const payload = buildPayload();

    try{
      if(backendAvailable){
        const res = await fetch(ENDPOINTS.predict(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if(!res.ok || data.status === "erro"){
          throw new Error(data.detalhe || "A API retornou um erro ao calcular a predição.");
        }

        renderResult({ prediction: data.predicao_ansiedade_alta });
        loadHistory();
      }else{
        const result = mockPredict(payload);
        demoHistory.unshift(result);
        renderResult(result);
        renderHistory(demoHistory);
      }
    }catch(err){
      console.error("Erro ao gerar predição:", err);
      alert("Não foi possível calcular a predição. Verifique se o back-end está rodando e se o modelo foi carregado (models/melhor_modelo.pkl), depois tente novamente.");
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = "Calcular predição";
    }
  });

  refreshHistoryBtn.addEventListener("click", () => {
    checkBackend();
  });

  // inicialização
  checkBackend();
})();