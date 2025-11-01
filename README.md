# **🚀 Ollama Local LLM**

로컬에서 실행되는 Ollama LLM을 활용하여 프로젝트 코드를 분석하고 리팩토링 제안을 받는 웹 기반 코드 리뷰 및 범용 검색 시스템입니다. CPU 집약적인 계산 작업을 Worker Thread로 분리하고, 코드 분석 로직을 서비스 모듈로 완전히 분리하여 성능과 유지보수성을 모두 고려했습니다.

**✨ 주요 특징 (Features)**

- **웹 기반 UI:** 브라우저를 통해 파일 경로를 입력하고 분석 결과를 실시간으로 확인합니다.
- **멀티 파일 분석:** 여러 개의 코드 파일 경로를 지정하여 프로젝트 단위의 통합 분석 및 구조 제안을 요청할 수 있습니다.
- **통합 모드 지원**:
    - **코드 분석 모드**: 여러 개의 파일 경로를 지정하여 프로젝트 단위의 통합 분석 및 구조 제안을 요청할 수 있습니다.
    - **일반 검색 모드**: 파일 접근 없이 LLM에게 범용적인 질문이나 정보를 요청할 수 있습니다.
- **한글화된 결과:** LLM 프롬프트에 한국어 답변을 명시적으로 강제하여 한글로 된 상세한 코드 리뷰를 받습니다.
- **경로 안전성:** 템플릿 리터럴 충돌을 방지하기 위해 파일 내용을 안전하게 이스케이프 처리하여 LLM에 전송합니다.
- *음성 피드백 (TTS): Gemini API를 사용하여 분석 결과를 음성으로 들을 수 있습니다. (유료 사용자에 한해서)
- **모듈화 및 성능:**
    - `analysis_service.js`로 Ollama 호출 로직을 분리하여 서버 로직(`index.js`)을 단순화했습니다.
    - CPU 바운드 작업(예: `/api/data` 라우트)을 **Worker Threads**(`api_router.js`)로 분리하여 서버의 메인 스레드 블로킹을 방지하고 애플리케이션의 응답성을 유지합니다.

**🛠️ 기술 스택 (Tech Stack)**

| **구분** | **기술** | **설명** |
| --- | --- | --- |
| **Backend** | Node.js (ESM), Express.js | 서버 구동, API 라우팅 및 정적 파일 서빙 |
| **LLM Engine** | Ollama | 로컬에서 LLM 모델을 실행하고 관리하는 플랫폼 |
| **Analysis** | `fetch`, `fs`, `path` | Ollama API 호출 및 로컬 파일 시스템 접근 |
| **Concurrency** | Worker Threads | CPU 집약적 계산 작업을 분리하여 메인 스레드 성능 확보 |
| **Frontend** | HTML, JavaScript (Client) | 웹 인터페이스 및 서버 요청 처리 |
| **TTS (Optional)** | Gemini API (Cloud) | 분석 결과를 음성으로 변환 (PCM → WAV) |

**📦 설치 및 사용법 (Installation & Usage)**

**1. 전제 조건**

- **Node.js:** Node.js 18 이상 버전이 설치되어 있어야 합니다.
- **Ollama:** 로컬에 [Ollama](https://ollama.com/)가 설치되어 실행 중이어야 합니다.
- **Ollama 모델:** 사용할 모델(`gpt-oss:20b` 또는 원하는 모델)이 로컬에 다운로드되어 있어야 합니다. (예: `ollama pull gpt-oss:20b`)
- *Gemini API Key (선택 사항): TTS 기능을 사용하려면 유효한 Gemini API 키가 필요합니다.

**2. 의존성 설치**

프로젝트 루트에서 Express 서버와 기타 필요한 모듈을 설치합니다.

```
npm install express

```

**3. 프로젝트 파일 구조**

주요 파일은 다음과 같습니다. 모든 파일은 프로젝트 루트 디렉토리에 위치합니다.

```
/
├── index.js              # 메인 서버 및 라우팅 (Express)
├── index.html            # 웹 UI (클라이언트)
├── analysis_service.js   # Ollama 분석 핵심 로직 모듈
├── api_router.js         # API 라우터 (Worker Thread 예시 포함)
├── user_service.js       # (Worker Thread에서 사용하는) 계산 로직 모듈
└── analyze_code.js       # (선택 사항) 명령줄 전용 분석 스크립트

```

**4. 서버 실행**

터미널에서 서버를 실행합니다.

```
node index.js

```

**5. 웹 접속 및 사용**

1. 서버가 실행되면 다음 주소로 웹 브라우저에 접속합니다. 🔗 **URL**: `http://localhost:3000/`
2. 프로젝트 루트에 `data` 폴더를 생성하고, 수정받고자 하는 프로젝트 파일을 넣습니다.
3. 웹 UI에서 **'💻 코드 분석'** 모드를 선택합니다.
4. 입력란에 분석하고자 하는 파일의 상대 경로 또는 절대 경로를 입력합니다. (예: `data/index.html`)
5. **'코드 분석' 버튼을 클릭하거나 Enter 키를 누릅니다. (shift+Enter로 줄바꿈)**
6. 서버가 파일 내용을 읽어 Ollama API에 요청하고, 수십 초 후 한국어로 작성된 코드 리뷰 결과가 화면에 표시됩니다.
7. **'🌐 일반 검색'** 모드를 선택하고 일반 쿼리를 입력하면, LLM에게 범용적인 질문을 할 수 있습니다.

**💻 명령줄 스크립트 사용 (Analyze CLI)**

웹 UI 대신 터미널에서 즉시 분석 결과를 확인하고 싶을 때 사용합니다.

`node analyze_code.js [파일경로1] [파일경로2] ...`

**예시:**

`node analyze_code.js index.js index.html`

**스크린샷**

<img width="813" height="773" alt="스크린샷 2025-11-02 오전 7 18 17" src="https://github.com/user-attachments/assets/58d318ba-f206-4285-9902-f22f6c4e8992" />

<img width="813" height="473" alt="스크린샷 2025-11-02 오전 7 20 12" src="https://github.com/user-attachments/assets/226b73af-1b94-4eb2-9817-1483f10372b3" />

<img width="813" height="543" alt="스크린샷 2025-11-02 오전 7 28 52" src="https://github.com/user-attachments/assets/b3f7d838-5f49-409e-8512-802132ea2c81" />

<img width="813" height="534" alt="스크린샷 2025-11-02 오전 7 29 03" src="https://github.com/user-attachments/assets/46359fa6-fdbc-48ee-826b-53d56241de6b" />

<img width="813" height="569" alt="스크린샷 2025-11-02 오전 7 29 41" src="https://github.com/user-attachments/assets/e58ecbe7-e2b5-426d-b2e2-74c1e9aaf112" />



