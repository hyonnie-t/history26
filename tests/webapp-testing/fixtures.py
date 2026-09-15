"""
목/스텁 응답 픽스처 모음.

[열린 질문] "GAS 백엔드를 실제로 호출하는 테스트로 할지, 목/스텁으로 대체할지"에
대한 이 저장소의 결론: **쓰기(action=...) 경로는 항상 mock, 읽기(mode=...) 경로는
테스트마다 개별 판단**.

근거: 이 백엔드(history26_backend/code.gs)는 SHEET_NAME = '게임활동_로그' 시트
하나를 이 포털과 여러 개별 웹앱(crusades, his_judge_goryeo, gongmin 등)이
gameName으로만 구분해서 같이 쓴다 — 즉 쓰기 action을 실제로 호출하면 테스트
데이터가 실제 교사 대시보드·성적 계산에 섞여 들어갈 위험이 있다. 반면 읽기
전용 mode(mode=curriculum 등)는 학생 개인정보가 없고 실수로 호출해도 부작용이
없어, "실제 호출 vs 목" 중 상황에 따라 고를 수 있다 — 다만 실제 호출을 고르면
그날 교사가 실제로 등록해둔 시트 내용에 테스트 결과가 좌우돼(예: 특정 학년에
차시가 하나도 없으면 SKIP) deterministic하지 않다는 트레이드오프가 생긴다.
그래서 우선순위가 높은 스모크 테스트(포털 렌더 등)는 여기 있는 고정 픽스처로
mock해 어떤 환경에서도 같은 결과가 나오게 만들었다.
"""

CURRICULUM_FIXTURE = {
    "result": "success",
    "grades": {
        "2": {
            "subject": "역사",
            "lessons": [
                {
                    "id": "1차시_테스트활동",
                    "title": "[테스트] 1차시 판단형 활동",
                    "type": "judgment",
                    "sequential": False,
                    "owner": "",
                    "activities": [
                        {
                            "id": "1차시_테스트활동",
                            "url": "https://example.com/fake-activity-1",
                            "title": "[테스트] 1차시 판단형 활동",
                        }
                    ],
                }
            ],
        },
        "3": {
            "subject": "역사",
            "lessons": [
                {
                    "id": "1차시_테스트활동_3",
                    "title": "[테스트] 3학년 1차시 활동",
                    "type": "judgment",
                    "sequential": True,
                    "owner": "",
                    "activities": [
                        {
                            "id": "1차시_테스트활동_3a",
                            "url": "https://example.com/fake-activity-3a",
                            "title": "[테스트] 활동 A",
                        },
                        {
                            "id": "1차시_테스트활동_3b",
                            "url": "https://example.com/fake-activity-3b",
                            "title": "[테스트] 활동 B",
                        },
                    ],
                }
            ],
        },
    },
}

# 체크인 문항 없음 — startPreview()가 checkinToday를 아예 안 물어보게 해서
# (CHECKIN_PLAN[grade]가 없으면 스킵) 그날 실제로 지정된 체크인 여부와
# 무관하게 결과가 항상 같아지도록 고정한다.
CHECKIN_PLAN_FIXTURE = {"result": "success", "plan": {}}


def route_history26_backend(route, request):
    """page.route(WEBAPP_URL_GLOB, route_history26_backend)로 등록해서 쓴다.

    GET(mode=...)는 위 고정 픽스처로 응답하고, POST(action=...)는 전부
    성공 응답으로 스텁한다 — 실제 시트에 쓰지 않는다."""
    url = request.url
    if request.method == "GET":
        if "mode=curriculum" in url and "Admin" not in url:
            route.fulfill(status=200, content_type="application/json", body=_json(CURRICULUM_FIXTURE))
            return
        if "mode=checkinPlan" in url and "Admin" not in url:
            route.fulfill(status=200, content_type="application/json", body=_json(CHECKIN_PLAN_FIXTURE))
            return
        route.fulfill(status=200, content_type="application/json", body=_json({"result": "error", "message": "no fixture for this GET"}))
        return
    if request.method == "POST":
        route.fulfill(status=200, content_type="application/json", body=_json({"result": "success"}))
        return
    route.continue_()


def _json(obj):
    import json

    return json.dumps(obj)
