# Frontend: умный подбор подрядчиков

Одна русскоязычная страница: условия → настоящий `POST /api/recommend` → до трёх карточек с объяснениями backend. Справочники: `GET /api/meta`. При открытии, редактировании или загрузке пресета подбор не запускается.

## Проверенное окружение

Windows, Node.js **22.23.2**, npm **10.9.8**, Chrome **153**. React **19.3.0**, Vite **8.3.0**, Vitest **5.0.1**, Playwright **1.63.0**. Остальные версии зафиксированы в `package.json` и `package-lock.json`. ESLint 9 выбран для совместимости с peer dependencies React-плагина, без `--force` и `--legacy-peer-deps`.

Node установлен в этой папке локально; системный PATH не менялся. Для текущей машины из корня:

```powershell
$env:Path = (Resolve-Path '.\.tools\node\node-v22.23.2-win-x64').Path + ';' + $env:Path
cd frontend
npm.cmd ci
npm.cmd run dev
```

PATH меняется только для терминала. `.tools` и вспомогательное `.venv` не входят в исходники frontend и не нужны другим участникам.

## Запуск

Предварительно запустите **существующий** backend по [его README](../backend/README.md). Его код, данные и зависимости frontend не изменяет. В проверенном сеансе сервер уже работал на 8000; второй экземпляр не запускался. Backend-тесты выполнялись установленным Python 3.13.15:

```powershell
# Из корня, на проверенной машине:
cd backend
& 'C:\Users\bekar\AppData\Local\Programs\Python\Python313\python.exe' -m pytest -q
# Если требуется запуск при свободном порте:
& 'C:\Users\bekar\AppData\Local\Programs\Python\Python313\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

На другой машине используйте настроенное окружение backend, персональный путь не является зависимостью frontend.

Windows PowerShell, из корня:

```powershell
cd frontend
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

Linux/macOS, из корня (эквивалентные команды; фактический запуск проверен на Windows):

```sh
cd frontend
npm ci
test -f .env.local || cp .env.example .env.local
npm run dev
```

Открыть **http://127.0.0.1:5173**. Значения по умолчанию работают и без `.env.local`.

## Подключение

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | Публичная база с префиксом backend, например `https://host/api` |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` | Upstream локального Vite, только серверная конфигурация |
| `VITE_API_TIMEOUT_MS` | `10000` | Срок ожидания клиента; не прекращает Python-вычисления |

Vite загружает `.env`, `.env.local`, файлы режима и переменные окружения. После изменения перезапустите dev-сервер, а production-клиент пересоберите.

**Путь сохраняется:** `/api/recommend` → Vite → `http://127.0.0.1:8000/api/recommend`. Удалять `/api` нельзя. Запросы приложения находятся только в `src/api.js`; нет автоматических повторов или кэша выдачи.

Все `VITE_*` публичны. Ключи и токены сюда не помещаются; LLM из браузера не вызывается.

## Проверки

Из `frontend/` (PowerShell: `npm.cmd`, Linux/macOS: `npm`):

```sh
npm ci
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm test` запускает Vitest один раз. Моки находятся только в `src/tests/`. E2E читает CSV **в Node-процессе тестов**, проверяет настоящий сервер, не перехватывает `/recommend`.

По умолчанию используется установленный Chrome. Если его нет:

```powershell
npx.cmd playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm.cmd run test:e2e
```

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

Проверка production-сборки с **локальным** proxy на 4173:

```powershell
npm.cmd run build
$env:E2E_BUILT = '1'
npm.cmd run test:e2e
Remove-Item Env:E2E_BUILT
```

```sh
npm run build
E2E_BUILT=1 npm run test:e2e
```

Для ручного просмотра: `npm run preview`, http://127.0.0.1:4173. Playwright запускает собственный dev/preview, если порт свободен; существующий backend не останавливает. Отчёты и скриншоты: игнорируемые `test-results/` и `playwright-report/`.

## Production-маршрутизация

`dist/` — статические файлы. Dev/preview proxy не является production-инфраструктурой. Применимый вариант — **same-origin reverse proxy**: хост отдаёт `dist/`, а `/api/` направляет в существующий FastAPI с сохранением пути. Конфигурация для передачи ответственному за развёртывание:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
}
location / {
    root /srv/hackalem/frontend/dist;
    try_files $uri $uri/ /index.html;
}
```

Собирать с `VITE_API_URL=/api`. Внешний сервер не настраивался. Проверка preview подтверждает собранный клиент и локальный маршрут, **не** публичный deployment.

Для раздельных доменов нужны публичный URL с `/api` и разрешённый origin frontend. Сейчас backend разрешает `http://localhost:5173` и `http://localhost:3000`. Например, прямое подключение страницы `http://127.0.0.1:4173` потребовало бы добавления именно этого origin; проверенный same-origin proxy не требует изменения CORS. Продакшен-домен ещё не выбран.

## Справочники и ограничения

Текущий `/api/meta` превращает `city` в символы. Остальные справочники берутся из API. Только при однобуквенных городах используются `src/data/cities.json` и явное пояснение об источнике/неподтверждённой версии сервера. Исправленный API с полными городами будет использован автоматически.

`scripts/export-cities.js` читает **backend/data/contractors.csv** полноценным CSV-парсером. Экспортируются только города, путь и SHA-256 — без профилей, флагов, цен, описаний и календарей. Хеш считается по UTF-8 с переводами строк LF: автоматическое преобразование LF/CRLF при клонировании не меняет версию данных. Сборка/тесты проверяют хеш. После осознанного обновления CSV:

```sh
npm run metadata:export
npm test
```

Календарь **23.09–31.12.2026** включает границы. Бюджет — целые тенге **больше нуля** по реальному `gt=0`; пустой бюджет не равен нулю. Длительность положительна либо `null`, принимает запятую; язык — один либо `null`. Цены не умножаются на часы.

`synthetic` показывается из API. `price_imputed`/`city_imputed` сейчас отсутствуют, их значения не угадываются по CSV. Компоненты покажут предупреждения, если API явно вернёт boolean. Известные проблемы объяснений — в [интеграционном отчёте](../docs/frontend-integration.md).

## Устройство

- `App.jsx`, `components/` — форма, пресеты, карточки, результаты и диагностика.
- `api.js` — fetch, AbortController, таймаут, HTTP/JSON/422.
- `adapters.js` — единая проверка и преобразование действующего контракта.
- `hooks/useRecommendations.js` — снимок запроса, отмена, защита от поздних ответов, сравнение дат.
- `utils/` — проверка чисел/даты и форматирование без UTC-сдвига.
- `src/tests/`, `e2e/` — изолированные тесты клиента и настоящая интеграция.

Справочные материалы: [Vite](https://vite.dev/guide/), [браузеры Playwright](https://playwright.dev/docs/browsers). Сведения о backend основаны на его локальном коде и живых ответах.
