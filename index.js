// index.js (Main Server File)
import express from "express";
// 정적 파일 서빙을 위한 path 모듈
import path from "path";
import { fileURLToPath } from "url";
// 기존 API 라우터 (현재는 /api/data)
import apiRouter from "./api_router.js";
// 새로 생성된 분석 서비스 모듈
import { runAnalysis } from "./analysis_service.js";
import process from "process";

const app = express();
const PORT = 3000;

// ESM 환경에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// ----------------------------------------------------------------------
// 1. 정적 파일 서빙 설정
// ----------------------------------------------------------------------
// 현재 디렉토리를 기준으로 index.html 및 기타 정적 파일을 제공합니다.
// 즉, http://localhost:3000/ 으로 접속하면 index.html이 로드됩니다.
app.use(express.static(__dirname));

// 루트 주소 (/) 접속 시 index.html 자동 서빙
app.get("/", (req, res) => {
    // path.join을 사용하여 현재 디렉토리의 index.html 파일을 전송합니다.
    res.sendFile(path.join(__dirname, "index.html"));
});

// ----------------------------------------------------------------------
// 2. 새로운 /analyze 라우트 핸들러
// ----------------------------------------------------------------------
app.post("/analyze", async (req, res, next) => {
    try {
        const { filePaths } = req.body; // 웹 UI에서 전달된 파일 경로 배열

        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            return res.status(400).json({
                error: "Bad Request",
                message:
                    "분석할 파일 경로(filePaths) 배열이 요청 본문에 포함되어야 합니다.",
            });
        }

        // analysis_service를 호출하여 Ollama 분석 실행
        const analysisResult = await runAnalysis(filePaths);

        // LLM 응답을 클라이언트로 반환
        res.json({ result: analysisResult });
    } catch (err) {
        // 분석 중 발생한 오류는 에러 핸들러로 전달
        next(err);
    }
});

// 기존 API 라우터 연결 (예: /api/data)
app.use("/api", apiRouter);

// ----------------------------------------------------------------------
// 3. 전역 오류 핸들러
// ----------------------------------------------------------------------
app.use((err, req, res, next) => {
    console.error(`[Global Error] ${err.stack}`);

    // 클라이언트에 사용자 친화적인 오류 메시지 반환
    res.status(500).json({
        error: "Analysis Error",
        message: "코드 분석 중 서버에서 심각한 오류가 발생했습니다.",
        detail: err.message,
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(
        `🚀 Web Code Reviewer Server Running on http://localhost:${PORT}`
    );
    console.log(`[UI] Open in browser: http://localhost:${PORT}/index.html`);
    console.log(
        `[API] Analysis Endpoint: POST http://localhost:${PORT}/analyze`
    );
    console.log(`======================================================\n`);
});
