import { FC } from 'react';
import './ProgressIndicator.css';

interface ProgressIndicatorProps {
    stage: string;
    message?: string;
}

const stageLabels: Record<string, string> = {
    thinking: '생각 중이에요...',
    llm_processing: '잠시만요, 생각 정리 중이에요!',
    tool_selected: '필요한 도구를 골랐어요!',
    tool_start: '분석을 시작해볼게요!',
    tool_collecting_internal: '내부 정보를 살펴보고 있어요...',
    tool_collected_internal: '내부 정보 확인 완료!',
    tool_collecting_external: '외부에서 필요한 걸 찾아보고 있어요...',
    tool_collected_external: '외부 정보도 잘 찾아왔어요!',
    tool_decoding_payload: '페이로드를 해석하는 중이에요...',
    tool_decoded_payload: '해석 완료! 이제 분석해볼게요.',
    tool_analyzing_payload: '페이로드 분석 중이에요...',
    tool_analyzed_payload: '분석 다 됐어요!',
    tool_retrieving_context: '관련 내용을 찾아보고 있어요...',
    tool_retrieved_context: '참고할 정보 찾았어요!',
    tool_embedding: '질문을 임베딩하는 중이에요...',
    tool_searching: '정보를 검색하는 중이에요...',
    tool_completed: '도구 작업은 여기까지 완료됐어요!',
    generating_answer: '답변 완성 중이에요... 조금만 기다려주세요!',
    tool_error: '도구 사용 중 문제가 생겼어요.',
    tool_analyzing_question: '질문 분석 중이에요...',
    tool_searching_metadata: '메타정보를 검색 중이에요...',
    tool_generating_sql: 'SQL 쿼리를 생성 중이에요...',
    tool_executing_sql: 'SQL 쿼리를 실행 중이에요...',
    tool_analyzing_query_results: 'SQL 쿼리 실행 결과를 분석 중이에요...',
    tool_text2seql_retrieval: '메타정보를 검색 중이에요...',
    tool_text2seql_generation: 'SeQL 쿼리를 생성 중이에요...',
    tool_text2seql_shovel_pending: 'SeQL 쿼리를 실행 중이에요...',
};

// 시안의 streaming 블록 — 좌측 "AGENT · 실행 중" 펄스 라벨 + 현재 단계 텍스트 + 깜빡이는 커서
export const ProgressIndicator: FC<ProgressIndicatorProps> = ({ stage }) => {
    const label = stageLabels[stage] || stage;
    return (
        <div className="progress-row" role="status" aria-live="polite">
            <div className="progress-side">AGENT · 실행 중</div>
            <div className="progress-body">
                <span className="progress-stage mono-label">{stage}</span>
                <span className="progress-label">
                    {label}
                    <span className="progress-caret" aria-hidden />
                </span>
            </div>
        </div>
    );
};
