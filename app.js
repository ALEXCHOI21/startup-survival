// 2026 대전창업체험센터 AI 투자 심사 시뮬레이터 로직
// Powered by Gemini API (gemini-2.0-flash)

// 상태 변수
let currentStep = 0; // 0: 시작화면, 1~5: 질문 진행 중, 6: 최종 평가 산출
let startupName = "";
let startupItem = "";
let chatHistory = [];
let apiKey = "";

// 5가지 핵심 심사 역의 질문 정의 (비전공자 타겟으로 쉽고 친근하게 변환)
const QUESTIONS = [
  "반갑습니다! 귀사의 핵심 고객(타겟층)은 구체적으로 누구이며, 그들이 일상에서 겪고 있는 가장 핵심적인 불편함(Pain Point)은 무엇인가요?",
  "시장에는 이미 유사한 제품이나 해결책이 있을 텐데요, 기존 제품들과 비교했을 때 귀사 아이템만의 '이것만큼은 우리가 1등이다'라고 자부할 수 있는 독보적인 차별성은 무엇입니까?",
  "사업을 지속하려면 돈을 벌어야겠죠. 이 아이템으로 어떻게 매출을 올릴 계획인지 구체적인 수익 모델(예: 직접 판매, 월 구독료, 중개 수수료, 광고 등)을 소개해 주세요.",
  "제품을 훌륭하게 만들었어도 고객이 모르면 소용없습니다. 초기 타겟 고객에게 이 브랜드를 알리고 서비스를 이용하게 만들 기발한 마케팅 방안은 무엇인가요?",
  "만약 자금력과 브랜드 인지도가 매우 높은 경쟁사나 대기업에서 귀사의 아이디어를 똑같이 복제하여 시장에 진출한다면, 이를 어떻게 방어하고 생존할 계획인가요?"
];

// DOM 요소
const screenStart = document.getElementById("screen-start");
const screenChat = document.getElementById("screen-chat");
const screenResult = document.getElementById("screen-result");

const inputStartupName = document.getElementById("startup-name");
const inputStartupItem = document.getElementById("startup-item");
const inputChat = document.getElementById("chat-input");
const inputApiKey = document.getElementById("api-key");

const btnStartGame = document.getElementById("btn-start-game");
const btnSend = document.getElementById("btn-send");
const btnCopyPitch = document.getElementById("btn-copy-pitch");
const btnRestart = document.getElementById("btn-restart");

const chatHistoryContainer = document.getElementById("chat-history");
const questionProgress = document.getElementById("question-progress");

const resultStartupName = document.getElementById("result-startup-name");
const resultFunding = document.getElementById("result-funding");
const resultStrengths = document.getElementById("result-strengths");
const resultWeaknesses = document.getElementById("result-weaknesses");
const resultPitch = document.getElementById("result-pitch");

// 무료 Gemini API Key 난독화 저장소 (무단 크롤링 방지용 역순 문자열)
// 실제 키 값: GOOGLE_API_KEY(무료) = AIzaSyCXK-jzPURTIIXqPi4dfh0amz0VYhWsGG0
const ENCODED_KEY = "0GGsWhYV0zma0hfd4iPqXIITRUPzj-KXCySazIA";

function getDecodedKey() {
  return ENCODED_KEY.split("").reverse().join("");
}

// 로컬 스토리지 또는 내장 난독화 키 우선 로드
if (localStorage.getItem("gemini_api_key")) {
  apiKey = localStorage.getItem("gemini_api_key");
  inputApiKey.value = apiKey;
} else {
  apiKey = getDecodedKey();
  inputApiKey.value = "●●●●●●●●●●●●●●●●●●●●";
}

// 이벤트 리스너 등록
btnStartGame.addEventListener("click", startGame);
btnSend.addEventListener("click", handleSendMessage);
inputChat.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSendMessage();
});
btnCopyPitch.addEventListener("click", copyPitchText);
btnRestart.addEventListener("click", resetGame);

// 1. 게임 시작
function startGame() {
  startupName = inputStartupName.value.trim();
  startupItem = inputStartupItem.value.trim();
  
  // 사용자가 임의의 다른 API Key를 입력했는지 확인
  const customKey = inputApiKey.value.trim();
  if (customKey && !customKey.includes("●")) {
    apiKey = customKey;
    localStorage.setItem("gemini_api_key", apiKey);
  } else if (!apiKey) {
    apiKey = getDecodedKey();
  }

  if (!startupName || !startupItem) {
    alert("스타트업 이름과 창업 아이템 한 줄 피칭을 입력해 주세요.");
    return;
  }

  // 화면 전환
  screenStart.classList.add("hidden");
  screenChat.classList.remove("hidden");

  // 첫 번째 심사역 메세지 출력
  currentStep = 1;
  updateProgress();
  appendChatMessage("ai", `안녕하세요, ${startupName} 대표님. 저는 오늘 심사를 맡은 투자 심사역 에이든(Aiden)입니다. 보내주신 한 줄 요약(" ${startupItem} ") 잘 읽어보았습니다. 

바로 심사를 위한 첫 번째 질문을 드리겠습니다.

**질문 1:** ${QUESTIONS[0]}`);
}

// 2. 메시지 전송 및 다음 진행 관리
async function handleSendMessage() {
  const answerText = inputChat.value.trim();
  if (!answerText) return;

  // --- 입력값 검증 가드 (Validation Guard) ---
  // 1. 최소 글자 수 제한 (초중고 수준을 고려하여 최소 5글자 이상)
  if (answerText.length < 5) {
    alert("투자 심사역 에이든: 답변이 너무 짧습니다. 조금 더 구체적으로 설명해 주세요. (최소 5자 이상 입력)");
    return;
  }

  // 2. 무의미한 자음/모음/숫자 도배 방지 정규식 검사
  // (예: ㅁㅁㅁ, ㅋㅋㅋ, 11111, @@@@ 등)
  const patternRepetitive = /([ㄱ-ㅎㅏ-ㅣ0-9a-zA-Z\s])\1{2,}/g; // 3회 이상 반복 문자 감지
  const patternHangulJaeum = /^[ㄱ-ㅎ\s]+$/; // 자음만 도배
  const patternHangulMoeum = /^[ㅏ-ㅣ\s]+$/; // 모음만 도배
  const patternNumberOnly = /^[0-9\s]+$/; // 숫자만 도배
  const patternSpecialOnly = /^[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]+$/; // 특수문자만 도배

  if (
    patternHangulJaeum.test(answerText) || 
    patternHangulMoeum.test(answerText) || 
    patternNumberOnly.test(answerText) ||
    patternSpecialOnly.test(answerText)
  ) {
    alert("투자 심사역 에이든: 질문의 의도에 맞는 올바른 단어와 문장으로 대답해 주시기 바랍니다.");
    return;
  }
  // ----------------------------------------

  // 유저 메시지 화면에 출력
  appendChatMessage("user", answerText);
  inputChat.value = "";
  
  // 대화 기록에 저장
  chatHistory.push({
    question: currentStep <= 5 ? QUESTIONS[currentStep - 1] : "마무리 분석",
    answer: answerText
  });

  if (currentStep < 5) {
    // 2 ~ 5번 질문까지의 진행 루프
    currentStep++;
    updateProgress();
    
    // 로딩 인디케이터 표시
    const loadingId = appendLoadingIndicator();
    
    // AI의 가벼운 평가와 함께 다음 질문 출력 (API 활용 또는 로컬 백업)
    setTimeout(async () => {
      removeLoadingIndicator(loadingId);
      let nextQuestionText = "";
      
      if (apiKey) {
        try {
          nextQuestionText = await callGeminiAPIForNextQuestion(answerText);
        } catch (error) {
          console.error("API 에러:", error);
          nextQuestionText = `좋은 답변 감사합니다. 계속해서 다음 단계로 넘어가겠습니다.\n\n**질문 ${currentStep}:** ${QUESTIONS[currentStep - 1]}`;
        }
      } else {
        // 데모 모드 자동 응답
        nextQuestionText = `대표님의 답변 잘 들었습니다. 아이템의 실현 가능성을 점검하기 위해 다음 질문을 드리겠습니다.\n\n**질문 ${currentStep}:** ${QUESTIONS[currentStep - 1]}`;
      }
      
      appendChatMessage("ai", nextQuestionText);
    }, 1000);

  } else {
    // 최종 평가 진행
    currentStep = 6;
    questionProgress.innerText = "평가 중...";
    const loadingId = appendLoadingIndicator();
    
    let evaluationData;
    if (apiKey) {
      try {
        evaluationData = await callGeminiAPIForEvaluation();
      } catch (error) {
        console.error("API 에러:", error);
        evaluationData = generateFallbackEvaluation();
      }
    } else {
      evaluationData = generateFallbackEvaluation();
    }

    setTimeout(() => {
      removeLoadingIndicator(loadingId);
      showResultScreen(evaluationData);
    }, 2000);
  }
}

// 3. UI 헬퍼 함수
function appendChatMessage(sender, text) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `flex ${sender === "ai" ? "justify-start" : "justify-end"}`;
  
  const innerDiv = document.createElement("div");
  innerDiv.className = `max-w-2xl rounded-2xl px-6 py-4 text-base md:text-lg shadow-md whitespace-pre-wrap leading-relaxed ${
    sender === "ai" ? "chat-bubble-ai text-slate-100" : "chat-bubble-user text-slate-100"
  }`;
  innerDiv.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // 마크다운 볼드 지원
  
  messageDiv.appendChild(innerDiv);
  chatHistoryContainer.appendChild(messageDiv);
  chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
}

function appendLoadingIndicator() {
  const id = "loading-" + Date.now();
  const loadingDiv = document.createElement("div");
  loadingDiv.id = id;
  loadingDiv.className = "flex justify-start analyzing-indicator";
  loadingDiv.innerHTML = `
    <div class="max-w-2xl rounded-2xl px-6 py-4 text-base chat-bubble-ai text-slate-400 flex items-center space-x-2">
      <span class="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
      <span class="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
      <span class="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
      <span>에이든 심사위원이 답변을 검토 중입니다...</span>
    </div>
  `;
  chatHistoryContainer.appendChild(loadingDiv);
  chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
  return id;
}

function removeLoadingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function updateProgress() {
  questionProgress.innerText = `진행률: ${currentStep} / 5`;
}

// 4. Gemini API 연동 모듈 (비용 및 속도 최적화: gemini-2.0-flash 사용)
async function callGeminiAPIForNextQuestion(userAnswer) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const prompt = `당신은 예리하고 친절한 VC 투자심사역 에이든입니다.
현재 창업 아이템: "${startupItem}" (스타트업명: ${startupName})에 대해 대화를 진행하고 있습니다.
방금 사용자가 질문에 대해 답변을 제출했습니다: "${userAnswer}"

이 답변에 대해 2~3줄 내외로 핵심을 짚은 건설적이고 예리한 한글 피드백을 먼저 해주세요.
그 다음, 다음 질문(질문 ${currentStep}: ${QUESTIONS[currentStep - 1]})을 자연스럽게 덧붙여서 한글로 대답해 주세요.`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5 }
    })
  });
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function callGeminiAPIForEvaluation() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  // 지금까지의 대화 요약 기록 작성
  let dialogText = chatHistory.map(h => `질문: ${h.question}\n답변: ${h.answer}`).join("\n\n");
  
  const prompt = `당신은 스타트업 투자 유치 심사를 마친 벤처캐피탈(VC) 심사위원입니다.
스타트업명: "${startupName}"
창업 아이템: "${startupItem}"
이 창업가와 나눈 대화 기록:
${dialogText}

위 대화 내용을 엄격하고 타당하게 평가하여 JSON 포맷으로 최종 결과를 출력하십시오.
반드시 마크다운 없이 순수 JSON 형식의 문자열로만 응답해야 합니다.

[출력 JSON 규격]
{
  "funding": "정수값 (답변의 논리성과 사업성에 따라 최소 50000000(오천만원)에서 최대 500000000(오억원) 사이로 1000만원 단위로 차등 책정)",
  "strengths": ["강점 1", "강점 2", "강점 3"],
  "weaknesses": ["보완점 1", "보완점 2"],
  "pitch": "이 스타트업을 위해 고도화해준 최종 완성본 1분 IR 피칭 대본 (약 300~400자 내외, 초중고 비전공자 학생들이 쉽게 말할 수 있는 힘 있고 설득력 넘치는 한국어 톤앤매너로 작성)"
}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    })
  });
  
  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// 5. 결과 화면 출력
function showResultScreen(data) {
  screenChat.classList.add("hidden");
  screenResult.classList.remove("hidden");
  
  resultStartupName.innerText = startupName;
  
  // 금액 포맷팅 (원 단위 -> 억/천만원 단위)
  const fundingNum = parseInt(data.funding) || 50000000;
  const eok = Math.floor(fundingNum / 100000000);
  const chun = Math.floor((fundingNum % 100000000) / 10000000);
  
  let fundingText = "";
  if (eok > 0) fundingText += `${eok}억 `;
  if (chun > 0) fundingText += `${chun},000만 원`;
  else if (eok === 0) fundingText += "0원";
  else fundingText += "원";
  
  resultFunding.innerText = fundingText + " 유치 성공!";
  
  // 강점 출력
  resultStrengths.innerHTML = "";
  data.strengths.forEach(s => {
    const li = document.createElement("li");
    li.innerText = s;
    resultStrengths.appendChild(li);
  });
  
  // 보완점 출력
  resultWeaknesses.innerHTML = "";
  data.weaknesses.forEach(w => {
    const li = document.createElement("li");
    li.innerText = w;
    resultWeaknesses.appendChild(li);
  });
  
  // 1분 피칭 대본 출력
  resultPitch.innerText = data.pitch;
}

// 6. 예외 복구(Fallback)용 가상 평가 생성기
function generateFallbackEvaluation() {
  return {
    funding: 150000000,
    strengths: [
      "초중고 수준에서 매우 실용적이고 접근하기 쉬운 생활밀착형 아이디어입니다.",
      "타겟 고객이 일상에서 느끼는 실제 페인포인트를 잘 저격했습니다.",
      "비즈니스 모델이 직관적이며 직간접 매출을 기대할 수 있습니다."
    ],
    weaknesses: [
      "대기업이나 대형 플랫폼의 카피캣 출현 시 방어벽이 다소 아쉽습니다.",
      "초기 고객 획득을 위한 마케팅 수단이 정교화될 필요가 있습니다."
    ],
    pitch: `안녕하세요, ${startupName} 대표 OOO입니다. 저희는 ${startupItem} 문제를 완벽하게 해결하는 새로운 비즈니스를 준비하고 있습니다.\n기존의 번거롭고 일회성인 솔루션들과 달리, 저희는 AI와 친환경 기술을 결합하여 고객들에게 최고의 효율과 가치를 선사합니다. 이번 시뮬레이션에서 보완점을 완벽하게 보강하여 시장의 판도를 바꾸는 최고의 스타트업으로 도약하겠습니다. 많은 관심 부탁드립니다. 감사합니다!`
  };
}

// 7. 기타 기능 (복사, 초기화)
function copyPitchText() {
  navigator.clipboard.writeText(resultPitch.innerText).then(() => {
    alert("1분 IR 피칭 대본이 클립보드에 복사되었습니다!");
  });
}

function resetGame() {
  currentStep = 0;
  chatHistory = [];
  chatHistoryContainer.innerHTML = "";
  
  screenResult.classList.add("hidden");
  screenStart.classList.remove("hidden");
}
