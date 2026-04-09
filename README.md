# 2인용 포커 게임

GitHub Pages에서 정적 프론트엔드를 배포하고, Firebase Realtime Database를 이용해 원격 2인 접속이 가능하도록 만든 간단한 5카드 드로우 포커입니다.

## 기능
- 닉네임 입력 후 방 생성 / 참가
- 2명이 접속하면 자동 시작
- 각 플레이어 5장 배분
- 최대 3장까지 카드 교체
- 두 플레이어가 모두 교체 완료하면 자동 쇼다운
- 족보 비교 후 승패 표시
- 다음 라운드 진행 가능

## 파일 구성
- `index.html` : 화면 구조
- `styles.css` : UI 스타일
- `app.js` : 게임 로직, Firebase 동기화
- `firebase-config.example.js` : Firebase 설정 예시

## GitHub Pages 배포 방법
1. 새 GitHub 저장소를 생성합니다.
2. 이 폴더의 파일을 저장소에 업로드합니다.
3. `firebase-config.example.js` 를 복사해서 `firebase-config.js` 파일을 만듭니다.
4. Firebase 콘솔에서 Realtime Database를 활성화하고 `firebase-config.js` 값을 채웁니다.
5. GitHub 저장소의 **Settings > Pages** 에서 배포 브랜치를 설정합니다.
6. 배포 후 다음처럼 접속합니다.
   - 방 생성자: 사이트 접속 → 닉네임 입력 → 방 만들기
   - 참가자: 사이트 접속 → 닉네임 입력 → 방 코드 입력 → 방 참가

## Firebase Realtime Database 규칙 예시
개발용으로는 아래처럼 시작할 수 있습니다. 운영용 보안은 추가 설계가 필요합니다.

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## 주의사항
- 현재 구조는 **서버 없는 데모용** 입니다.
- 카드 정보가 클라이언트에 존재하므로 완전한 치트 방지는 어렵습니다.
- 실제 서비스로 운영하려면 Cloud Functions 같은 서버 측 판정 로직을 추가하는 것이 좋습니다.

## 추천 확장 기능
- 턴 제한 시간
- 채팅
- 점수 누적
- 베팅 / 칩 시스템
- 방 목록
- 관전자 모드
