// analysis_service.js
// API 라우터로부터 CODE_ANALYSIS 요청을 받아 파일 시스템 I/O 및 Ollama LLM 호출을 처리하는 서비스 계층입니다.

// 🚨 비동기 I/O를 위해 fs/promises 모듈 사용
import * as fs from "fs/promises";
import * as path from "path";

// Ollama API 설정
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "gpt-oss:20b";

// LLM에게 전달할 시스템 프롬프트 (페르소나 설정)
const SYSTEM_PROMPT = `
당신은 10년 경력의 시니어 백엔드 개발자입니다. 곧 암게 걸려 죽을 운명이며, 황급히 후계자를 가르쳐야 합니다. 그 후계자는 아직 node.js와 express.js를 배우는 학생이고, 코드를 배운지 2달이 조금 넘었습니다(현재 관심있는 것: 모듈화, validator, async-await, try-catch, http-status-code모듈깔아서 사용 배웠음). 다음 코드 파일들을 검토하고, "성능"을 개선할 수 있는 구체적인 수정 사항을 제안하고, 개선된 코드는 Markdown 코드 블록으로 제시하고, 수정의 근거는 번호가 매겨진 리스트로 상세하지만 짧고 명료하게 설명해주세요. **가장 중요합니다: 모든 답변은 예외 없이 한국어 경어체로 작성해야 합니다.**
`;

const USER_PROMPT_HEADER = `
[클린코드 관점으로 가능하면 긍정문으로, 불필요한 코드들은 없애고 중복되는 코드들은 모듈화, 폴더 구조를 맞춰서 코드 리팩토링을 해줘. 예를들어, 폴더/파일.확장자 코드, 다음 폴더/파일.확장자 코드 이런식으로. 그리고 전체적인 프로젝트 루트 폴더도 보여줘.]
`;

/**
 * 주어진 파일 경로 목록을 읽고, 내용을 통합하여 Ollama API에 분석을 요청합니다.
 * @param {string[]} filePaths - 분석할 파일 경로 배열
 * @returns {Promise<string>} Ollama LLM의 응답 텍스트
 */
export async function runAnalysis(filePaths) {
    let combinedContent = "";
    let processedFiles = [];

    // 파일 읽기 Promise 배열 생성 및 비동기 병렬 처리
    const fileReadPromises = filePaths.map(async (filePath) => {
        try {
            // 비동기 readFile 사용
            const fileContent = await fs.readFile(filePath, "utf8");

            // 백틱(\`)과 템플릿 보간 구문(\${)을 이스케이프
            let sanitizedContent = fileContent.replace(/`/g, "\\`");
            sanitizedContent = sanitizedContent.replace(/\$\{/g, "\\${");

            // 파일 경계선 명확히 표시
            const contentBlock = `\n--- 파일 시작: ${filePath} ---\n\n${sanitizedContent}\n\n--- 파일 끝: ${filePath} ---\n\n`;

            return { filePath, content: contentBlock };
        } catch (error) {
            // 파일을 찾지 못하면 오류를 기록하고 null 반환
            console.error(
                `[Analysis Service] 파일 읽기 오류: '${filePath}'를 읽을 수 없습니다. 건너뜁니다.`
            );
            return null;
        }
    });

    // 모든 파일 읽기 작업 완료 대기
    const results = await Promise.all(fileReadPromises);

    // 결과를 필터링하고 통합
    results.forEach((result) => {
        if (result) {
            combinedContent += result.content;
            processedFiles.push(result.filePath);
        }
    });

    if (processedFiles.length === 0) {
        throw new Error(
            "유효한 분석 파일을 찾지 못했습니다. 경로를 확인해 주세요."
        );
    }

    // 최종 통합된 쿼리 생성
    const USER_QUERY = `
${USER_PROMPT_HEADER}

--- 전체 프로젝트 코드 시작: 총 ${processedFiles.length}개 파일 ---

${combinedContent}

--- 전체 프로젝트 코드 끝 ---
`;

    // 2. Ollama API 호출
    try {
        // Ollama 'generate' API 페이로드 형식
        const payload = {
            model: MODEL_NAME,
            prompt: USER_QUERY,
            system: SYSTEM_PROMPT,
            stream: false,
            options: {
                temperature: 0.2, // 코드 리팩토링 및 창의적 제안을 위해 온도를 약간 높임
            },
        };

        console.log(`\n--- Ollama API 호출 시작 ---`);
        console.log(`모델: ${MODEL_NAME}`);
        console.log(`분석 파일: ${processedFiles.join(", ")}`);

        // fetch는 비동기 처리
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // 오류 발생 시 서버 응답의 상세 내용을 포함
            const errorData = await response.json();
            throw new Error(
                `Ollama HTTP Error: ${response.status} ${
                    response.statusText
                }. Detail: ${errorData.error || "N/A"}`
            );
        }

        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        console.error(
            `[Analysis Service] Ollama 호출 중 치명적인 오류 발생:`,
            error.message
        );
        // 클라이언트에게 오류 메시지 전달
        throw new Error(
            `Ollama API 오류: ${error.message}. 서버 실행 및 모델(${MODEL_NAME}) 다운로드 확인이 필요합니다.`
        );
    }
}
