// api_router.js
import express from "express";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
// Node.js 'url' 모듈에서 fileURLToPath 유틸리티를 가져와야 합니다.
import { fileURLToPath } from "url";
import { calculateScore } from "./user_service.js";
import process from "process";

const router = express.Router();

// ----------------------------------------------------------------------
// 1. Worker Thread Logic (메인 스레드가 아닐 경우, 여기서 실행됩니다.)
// ----------------------------------------------------------------------
if (!isMainThread) {
    const { values } = workerData;

    // NOTE: Worker Thread는 메인 스레드와 같은 모듈 환경에서 실행되므로
    // calculateScore를 직접 사용 가능합니다.

    const result = calculateScore(values);

    parentPort.postMessage(result);
    // 🚨 수정: process.exit(0) 대신 Worker가 자연스럽게 종료되도록 합니다.
    // Worker는 메시지를 전송한 후 작업이 완료되면 자동으로 종료됩니다.
    // process.exit(0);
}

/**
 * 2. CPU-Bound 작업을 Worker Thread에 위임하는 헬퍼 함수
 */
function runWorkerScoreCalculation(values) {
    return new Promise((resolve, reject) => {
        // 🚨 수정된 부분: URL을 Worker가 이해할 수 있는 파일 시스템 경로로 변환
        const workerPath = fileURLToPath(import.meta.url);

        const worker = new Worker(workerPath, {
            workerData: { values: values },
        });

        worker.on("message", resolve);
        worker.on("error", reject);
        worker.on("exit", (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}

/**
 * 3. 메모리 효율적인 대규모 데이터 생성 (Float64Array 사용)
 */
function fetchLargeDataSet() {
    const count = 10000;
    const values = new Float64Array(count);

    for (let i = 0; i < count; i++) {
        values[i] = Math.random() * 10;
    }

    return values;
}

// 4. API 라우터 핸들러
router.get("/data", async (req, res, next) => {
    try {
        const values = fetchLargeDataSet();
        // Worker Thread를 통해 계산 작업 분리
        const result = await runWorkerScoreCalculation(values);

        res.json({ score: result });
    } catch (err) {
        next(err);
    }
});

export default router; // ESM export
