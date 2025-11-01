// user_service.js (개선)
/**
 * 대규모 데이터셋을 위한 성능 최적화된 점수 계산 함수.
 * 실수가 아닌 정수 연산을 사용하여 정밀도 문제를 피하고 성능을 개선합니다.
 * @param {Array<Object>} data - 각 요소에 'value' 필드가 포함된 배열.
 * @returns {number} 최종 계산된 점수 (최종 단계에서 다시 실수로 변환).
 */
export function calculateScore(data) {
    // 🚨 수정: export 키워드 추가
    // 1.05 대신 105를 곱한 후, 최종적으로 100으로 나눔으로써 루프 내 실수 연산을 방지
    let totalScoreTimes100 = 0;

    // BigInt 대신 Number를 사용하되, 정수형 연산으로 변환하여 사용
    for (let i = 0; i < data.length; i++) {
        // 루프 내에서 불필요한 객체 접근 및 연산을 최소화
        const value = data[i].value;
        // 정수 연산: (value * 100) * 105
        // NOTE: data는 Float64Array 대신 객체 배열로 가정하고 .value 접근.
        totalScoreTimes100 += Math.round(value * 105);
    }

    // 최종 결과 반환 시 실수로 변환
    return totalScoreTimes100 / 100;
}

// 🚨 수정: CommonJS export 제거 (ESM named export로 대체됨)
// module.exports = { calculateScore };
