import express from "express";
import fetch from "node-fetch";
// 파일 시스템 접근을 위해 fs/promises 모듈 사용
import fs from "fs/promises";
import path from "path";

// CommonJS의 require 대신 import를 사용하며, 환경 변수는 process.env에서 접근합니다.
const router = express.Router();

// 환경 변수는 index.js에서 dotenv가 로드된 후 process.env에 설정됩니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gpt-oss:20b";
const OLLAMA_URL =
    process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

// Base URL for the TTS API
const TTS_API_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

// ----------------------------------------------------------------------
// 1. LLM API 호출 함수 (Ollama /api/generate 규격 및 파일 I/O 통합)
//    - CODE_ANALYSIS 타입 시 다중 경로/코드 조각 처리 로직 강화
// ----------------------------------------------------------------------
async function callLlmModel(type, input) {
    let systemInstruction = "";
    let userQuery = input;

    // 1. 요청 유형(type)에 따라 프롬프트 구성 및 파일 내용 로드
    if (type === "CODE_ANALYSIS") {
        let fileContents = [];
        // 입력(input)을 줄바꿈 기준으로 분리하여 경로/코드 조각 리스트를 생성
        const filePathsOrChunks = input
            .split("\n")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        let successfulLoads = 0;

        // 각 경로/코드 조각에 대해 처리
        for (const p of filePathsOrChunks) {
            try {
                // 입력된 경로를 절대 경로로 변환하여 파일 시스템에 접근
                const fullPath = path.resolve(p);
                const fileContent = await fs.readFile(fullPath, "utf8");

                // 파일 내용을 포맷하여 배열에 추가
                fileContents.push(
                    `### 파일: ${p}\n\n\`\`\`\n${fileContent}\n\`\`\``
                );
                successfulLoads++;
            } catch (error) {
                // 파일 로드 실패 (파일 경로가 아니거나, 파일이 없거나)
                // 해당 입력 텍스트 자체를 코드 조각으로 간주하고 배열에 추가
                fileContents.push(
                    `### 코드 조각 (경로 오류 또는 직접 입력):\n\n\`\`\`\n${p}\n\`\`\``
                );
                console.warn(
                    `파일 로드 실패: ${error.message}. 입력된 텍스트를 코드 조각으로 간주합니다.`
                );
            }
        }

        // 최종 사용자 쿼리 구성
        const analysisSubject =
            successfulLoads === 0 && filePathsOrChunks.length === 1
                ? `다음은 분석할 코드 조각입니다.`
                : `다음은 분석할 ${successfulLoads}개의 파일 또는 코드 조각입니다.`;

        userQuery = `${analysisSubject}\n\n${fileContents.join("\n\n---\n\n")}`;

        systemInstruction = `당신은 숙련된 코드 분석가입니다. 제공된 코드/파일을 검토하고 잠재적인 버그, 성능 문제, 보안 취약점, 그리고 개선할 구조적 부분을 명확하게 설명하세요. 응답은 **반드시 Markdown 형식으로만** 작성해야 합니다.`;
    } else if (type === "GENERAL_SEARCH") {
        systemInstruction = `당신은 지식이 풍부하고 친절한 일반 검색 도우미입니다. 사용자의 질문에 대해 간결하고 정확하게 답변하세요. 응답은 **반드시 Markdown 형식으로만** 작성해야 합니다.`;
        userQuery = `사용자 질문:\n${input}`;
    }

    // 시스템 지침과 사용자 입력을 합쳐 하나의 'prompt' 문자열로 만듭니다.
    const finalPrompt = `${systemInstruction}\n\n${userQuery}`;

    // Ollama 'generate' API 페이로드 형식
    const payload = {
        model: OLLAMA_MODEL,
        prompt: finalPrompt, // 구성된 프롬프트 전체를 전달
        stream: false,
        options: {
            temperature: 0.1, // 코드 분석 및 정확한 검색을 위해 낮은 온도 유지
        },
    };

    try {
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `LLM 서버 오류: HTTP ${response.status} - ${errorBody}`
            );
        }

        const data = await response.json();
        const llmText = data.response;

        return llmText;
    } catch (error) {
        console.error("LLM API 호출 실패:", error);
        throw new Error(`LLM 모델 호출에 실패했습니다: ${error.message}`);
    }
}

// ----------------------------------------------------------------------
// 2. 통합 LLM 쿼리 엔드포인트 (/llm/query)
// ----------------------------------------------------------------------
router.post("/query", async (req, res) => {
    try {
        // 클라이언트는 type과 input을 담아 보냅니다.
        const { type, input } = req.body;

        // 필수 입력값 검증
        if (!type || !input) {
            return res
                .status(400)
                .json({ error: "type과 input 값을 모두 제공해야 합니다." });
        }

        // 지원하는 타입인지 검증
        const validTypes = ["CODE_ANALYSIS", "GENERAL_SEARCH"];
        if (!validTypes.includes(type)) {
            return res
                .status(400)
                .json({ error: "유효하지 않은 요청 유형(type)입니다." });
        }

        // LLM 모델 호출 (코드 분석 및 일반 검색 통합)
        const llmResponse = await callLlmModel(type, input);

        res.json({
            type: type,
            query: input,
            response: llmResponse,
        });
    } catch (err) {
        console.error("LLM API 처리 중 오류 발생:", err);
        res.status(500).json({
            error: `LLM API 처리 중 오류 발생: ${err.message}`,
        });
    }
});

// ----------------------------------------------------------------------
// 3. Gemini TTS Proxy (/tts)
// ----------------------------------------------------------------------
router.post("/tts", async (req, res) => {
    const { text } = req.body;

    // 1. API 키 누락 확인
    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            message: "TTS API Key is missing on the server.",
            detail: "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.",
        });
    }
    if (!text) {
        return res
            .status(400)
            .json({ message: "Text content is required for TTS." });
    }

    const payload = {
        contents: [
            {
                parts: [{ text: text }],
            },
        ],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Kore" },
                },
            },
        },
        model: "gemini-2.5-flash-preview-tts",
    };

    try {
        // 2. API Key를 URL 쿼리 파라미터로 추가합니다.
        const apiUrl = `${TTS_API_BASE_URL}?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Gemini API Error:", result);
            // 클라이언트에 오류 상태 코드를 전달
            return res.status(response.status).json({
                message: "Gemini TTS API 호출 실패.",
                // 특히 권한 관련 오류 메시지를 포함하여 전달
                detail:
                    result.error?.message || result.error || "Unknown error",
            });
        }

        // 오디오 데이터와 MIME 타입 추출
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType) {
            // 성공: 오디오 데이터를 클라이언트에 전송
            res.json({ audioData, mimeType });
        } else {
            console.error("TTS 응답에 오디오 부분이 누락됨:", result);
            res.status(500).json({
                message: "TTS 응답에서 오디오 데이터를 추출하지 못했습니다.",
            });
        }
    } catch (error) {
        console.error("서버 측 TTS 프록시 오류:", error);
        res.status(500).json({
            message: "TTS 처리 중 내부 서버 오류.",
            detail: error.message,
        });
    }
});

export default router;
