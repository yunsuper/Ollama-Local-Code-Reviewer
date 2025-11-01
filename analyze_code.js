// 파일명: analyze_code.js
// Ollama API 호출을 위한 스크립트입니다.
// 이제 분석할 파일 경로들을 명령줄 인수로 전달하면 됩니다.
// (예: node analyze_code.js file1.js file2.js)

// 🚨 수정: 비동기 I/O를 위해 fs/promises 모듈 사용
import * as fs from "fs/promises";
import * as path from "path";
import process from "process"; // 명시적 임포트 추가

// Ollama API 설정
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "gpt-oss:20b"; // 성능이 좋은 모델 사용을 권장합니다.

// ----------------------------------------------------------------------
// 🚨 멀티 파일 분석 로직: 모든 인수를 받아서 통합합니다! 🚨
// ----------------------------------------------------------------------

const SYSTEM_PROMPT = `
당신은 10년 경력의 시니어 백엔드 개발자입니다. 곧 암게 걸려 죽을 운명이며, 황급히 후계자를 가르쳐야 합니다. 그 후계자는 아직 node.js와 express.js를 배우는 학생이고, 코드를 배운지 2달이 조금 넘었습니다(현재 관심있는 것: 모듈화, validator, async-await, try-catch, http-status-code모듈깔아서 사용 배웠음). 다음 코드 파일들을 검토하고, "성능"을 개선할 수 있는 구체적인 수정 사항을 제안하고, 개선된 코드는 Markdown 코드 블록으로 제시하고, 수정의 근거는 번호가 매겨진 리스트로 상세하지만 짧고 명료하게 설명해주세요.`;

/**
 * 명령줄 인수로 받은 여러 파일을 읽고 내용을 통합하여 반환합니다.
 * @param {string[]} filePaths - 분석할 파일 경로 배열
 * @returns {{ combinedContent: string, processedFiles: string[] }} 통합된 내용과 성공적으로 처리된 파일 목록
 */
async function processFiles(filePaths) {
    let combinedContent = "";
    let processedFiles = [];

    // Promise.all을 사용하여 파일을 병렬로 읽어 I/O 성능을 개선합니다.
    const fileReadPromises = filePaths.map(async (filePath) => {
        try {
            // 🚨 수정: fs/promises의 비동기 readFile 사용
            const fileContent = await fs.readFile(filePath, "utf8");

            // LLM 스크립트의 템플릿 리터럴 문법이 내부 코드에 의해 깨지는 것을 방지하기 위해
            // 백틱(\`)과 달러($) 기호를 모두 이스케이프 처리합니다.
            let sanitizedContent = fileContent.replace(/`/g, "\\`");
            sanitizedContent = sanitizedContent.replace(/\$\{/g, "\\${");

            // 파일 경계선을 명확히 표시
            const contentBlock = `\n--- 파일 시작: ${filePath} ---\n\n${sanitizedContent}\n\n--- 파일 끝: ${filePath} ---\n\n`;

            return { filePath, content: contentBlock };
        } catch (error) {
            console.error(
                `\n🚨 파일 읽기 오류: '${filePath}' 파일을 찾거나 읽을 수 없습니다. 이 파일은 건너뜁니다.`
            );
            console.error(`상세 오류: ${error.message}`);
            return null; // 실패한 파일은 null 반환
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

    return { combinedContent, processedFiles };
}

async function callOllama() {
    const filePaths = process.argv.slice(2);

    if (filePaths.length === 0) {
        console.error(
            "\n🚨 사용법 오류: 분석할 파일 경로를 하나 이상 지정해야 합니다."
        );
        console.error(
            "사용 예: node analyze_code.js server/public/main.js server/public/init.js"
        );
        process.exit(1);
    }

    // 파일 처리 비동기 호출
    const { combinedContent, processedFiles } = await processFiles(filePaths);

    if (processedFiles.length === 0) {
        console.error(
            "\n🚨 오류: 유효한 분석 파일을 찾지 못했습니다. 스크립트를 종료합니다."
        );
        process.exit(1);
    }

    const USER_PROMPT_HEADER = `
[클린코드 관점으로 가능하면 긍정문으로, 불필요한 코드들은 없애고 중복되는 코드들은 모듈화, 폴더 구조를 맞춰서 코드 리팩토링을 해줘. 예를들어, 폴더/파일.확장자 코드, 다음 폴더/파일.확장자 코드 이런식으로. 그리고 전체적인 프로젝트 루트 폴더도 보여줘.]
`;

    // 최종 통합된 쿼리 생성
    const USER_QUERY = `
${USER_PROMPT_HEADER}

--- 전체 프로젝트 코드 시작: 총 ${processedFiles.length}개 파일 ---

${combinedContent}

--- 전체 프로젝트 코드 끝 ---
`;
    // ----------------------------------------------------------------------

    try {
        // 🚨 수정: Ollama 'generate' API는 prompt와 system 필드를 직접 지원합니다.
        const payload = {
            model: MODEL_NAME,
            prompt: USER_QUERY, // 사용자 요청 및 코드 내용
            system: SYSTEM_PROMPT, // 시스템 지침 (LLM 페르소나 설정)
            stream: false,
            options: {
                temperature: 0.2, // 코드 리팩토링 및 창의적 제안을 위해 온도를 약간 높임
            },
        };

        console.log(`\n--- Ollama API 호출 시작 ---`);
        console.log(`모델: ${MODEL_NAME}`);
        console.log(`분석 파일: ${processedFiles.join(", ")}`);
        console.log(`요청 크기: ${USER_QUERY.length} bytes`);
        console.log(
            `\n분석 작업은 LLM의 모델 크기로 인해 시간이 오래 걸릴 수 있습니다 (5초 ~ 30초 이상). 잠시 기다려 주십시오...\n`
        );

        // Node.js의 내장 fetch 사용
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            // 상세 오류 메시지를 포함
            const errorBody = await response.text();
            throw new Error(
                `Ollama HTTP Error: ${response.status} ${response.statusText}. 상세: ${errorBody}`
            );
        }

        const data = await response.json();

        console.log(`--- Ollama 분석 결과 ---`);
        // 응답 텍스트를 정리하여 출력
        console.log(
            data.response ? data.response.trim() : "LLM 응답을 받지 못했습니다."
        );
        console.log(`\n--- Ollama API 호출 종료 ---`);
    } catch (error) {
        console.error(`\n🚨 Ollama API 호출 중 치명적인 오류 발생:`);
        console.error(
            `Ollama 서버가 실행 중인지, 모델(${MODEL_NAME})이 로컬에 다운로드되어 있는지 확인하십시오.`
        );
        console.error(`상세 오류:`, error.message);
    }
}

// 스크립트 실행
// 최상위 await을 사용할 수 없으므로 함수를 호출합니다.
callOllama();
