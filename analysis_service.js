// analysis_service.js
import * as fs from "fs";
import * as path from "path";

// Ollama API 설정 (analyze_code.js에서 가져옴)
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "gpt-oss:20b";

// LLM에게 전달할 시스템 프롬프트 (analyze_code.js에서 가져옴)
const SYSTEM_PROMPT = `
당신은 10년 경력의 시니어 백엔드 개발자입니다. 곧 암게 걸려 죽을 운명이며, 황급히 후계자를 가르쳐야 합니다.  그 후계자는 아직 node.js와 express.js를 배우는 학생이고, 코드를 배운지 2달이 조금 넘었습니다(현재 관심있는 것: 모듈화, validator, async-await, try-catch, http-status-code모듈깔아서 사용 배웠음). 다음 코드 파일들을 검토하고, "성능"을 개선할 수 있는 구체적인 수정 사항을 제안하고, 개선된 코드는 Markdown 코드 블록으로 제시하고, 수정의 근거는 번호가 매겨진 리스트로 상세하지만 짧고 명료하게 설명해주세요. 모든 답변은 한국어 경어체로 작성해야 합니다.
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

    // 1. 모든 파일을 순회하며 읽고 안전화(Sanitization) 후 내용 통합
    for (const filePath of filePaths) {
        try {
            // 파일 내용 읽기
            let fileContent = fs.readFileSync(filePath, "utf8");

            // 백틱(\`)과 템플릿 보간 구문(\${)을 이스케이프하여
            // Outer Template Literal 충돌을 방지합니다. (이전 수정 반영)
            let sanitizedContent = fileContent.replace(/`/g, "\\`");
            sanitizedContent = sanitizedContent.replace(/\$\{/g, "\\${");

            // 파일 경계선을 명확히 표시
            combinedContent += `\n--- 파일 시작: ${filePath} ---\n\n${sanitizedContent}\n\n--- 파일 끝: ${filePath} ---\n\n`;
            processedFiles.push(filePath);
        } catch (error) {
            // 파일을 찾지 못하면 오류를 기록하고 건너뜁니다.
            console.error(
                `[Analysis Service] 파일 읽기 오류: '${filePath}'를 읽을 수 없습니다. 건너뜁니다.`
            );
            // 사용자에게 보낼 오류 메시지는 API 호출 실패 시 최종적으로 처리됩니다.
        }
    }

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
        const payload = {
            model: MODEL_NAME,
            prompt: USER_QUERY,
            system: SYSTEM_PROMPT,
            stream: false,
        };

        console.log(`\n--- Ollama API 호출 시작 ---`);
        console.log(`모델: ${MODEL_NAME}`);
        console.log(`분석 파일: ${processedFiles.join(", ")}`);

        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
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
        throw new Error(
            `Ollama API 오류: ${error.message}. 서버 실행 및 모델(${MODEL_NAME}) 다운로드 확인이 필요합니다.`
        );
    }
}
