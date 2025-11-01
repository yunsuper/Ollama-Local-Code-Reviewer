import express from "express";
import dotenv from "dotenv"; // .env 파일 로드를 위해 필요
import apiRouter from "./api_router.js";
import path from "path";
import { fileURLToPath } from "url";

// .env 파일을 로드하여 process.env에 접근할 수 있도록 합니다.
dotenv.config();

// 🚨 오류 해결: port 변수를 정의합니다.
const port = process.env.PORT || 3000;

// ESM 환경에서 __dirname을 사용하기 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML/CSS/JS 파일 제공 (프론트엔드)
// '/public' 디렉토리 대신 현재 디렉토리를 사용합니다.
app.use(express.static(__dirname));

// API 라우터 연결
// TTS, Query, Analysis 엔드포인트는 모두 api/llm 경로 아래에 연결됩니다.
app.use("/api/llm", apiRouter);

// 서버 시작 및 포트 리스닝
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    if (process.env.GEMINI_API_KEY) {
        console.log("GEMINI_API_KEY loaded successfully. TTS proxy is active.");
    } else {
        // 이 경고가 뜬다면 .env 파일에 키를 설정해야 합니다.
        console.warn(
            "WARNING: GEMINI_API_KEY is missing. TTS function will not work. Please check your .env file."
        );
    }
});
