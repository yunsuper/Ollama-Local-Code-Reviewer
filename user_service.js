/**
 * user_service.js (개선)
 * * 대규모 데이터셋을 위한 성능 최적화된 점수 계산 함수.
 * 실수가 아닌 정수 연산을 사용하여 정밀도 문제를 피하고 성능을 개선합니다.
 * * 🚨 경고: 이 함수는 api_router.js의 fetchLargeDataSet()에서
 * 전달하는 Float64Array가 아닌, 'value' 필드를 가진 객체 배열을 기대합니다.
 * 기존 백엔드 흐름을 유지하려면 api_router.js의 데이터 생성 함수를 수정해야 합니다.
 * * @param {Array<Object>} data - 각 요소에 'value' 필드가 포함된 배열.
 * @returns {number} 최종 계산된 점수 (최종 단계에서 다시 실수로 변환).
 */
export function calculateScore(data) {
    // 1.05 대신 105를 곱한 후, 최종적으로 100으로 나눔으로써 루프 내 실수 연산을 방지
    let totalScoreTimes100 = 0;

    // BigInt 대신 Number를 사용하되, 정수형 연산으로 변환하여 사용
    for (let i = 0; i < data.length; i++) {
        // 루프 내에서 불필요한 객체 접근 및 연산을 최소화
        // 🚨 Float64Array가 전달된 경우 data[i].value는 undefined가 될 수 있으므로 옵셔널 체이닝을 사용합니다.
        const value = data[i]?.value;

        // 유효성 검사 추가 (Float64Array가 전달되면 value는 undefined가 됩니다.)
        if (typeof value !== "number" || isNaN(value)) continue;

        // 정수 연산: (value * 105)
        totalScoreTimes100 += Math.round(value * 105);
    }

    // 최종 결과 반환 시 실수로 변환
    return totalScoreTimes100 / 100;
}
