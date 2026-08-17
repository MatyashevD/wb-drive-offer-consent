// ============================================================
// WB Drive · Прототип принятия оффера перевозчика
//
// Инцидент: багхантер разослал офферы реальным водителям. Один принял
// оффер до отзыва, выполнил задание — и остался без оплаты, потому что
// договора с этим перевозчиком у него нет.
//
// WB Drive — площадка: она сводит водителя и перевозчика, но в расчётах
// между ними не участвует. Значит задача интерфейса — не спрятать это в
// пользовательском соглашении, а сделать понятным до принятия оффера.
//
// Два режима:
//   «Сейчас»      — воспроизведение продакшена: плашка-сноска, красный
//                   отказ, принятие одним тапом без подтверждения
//   «Предложение» — идентификация перевозчика, схема движения денег,
//                   вопрос о договоре в момент интента, квитанция
// ============================================================

(function () {
    'use strict';

    const CARRIER = {
        name: 'ИП Кузьмина Анастасия Олеговна',
        short: 'ИП Кузьмина А. О.',
        inn: '505021556392',
        phone: '+7 916 240-18-55',
        sentAt: '17 августа, 18:52',
    };

    const TASK = {
        title: 'Разгрузка №256352',
        point: 'МО, д. Ближние Прудищи, 2/1',
        cargo: 'Тара 52 шт',
        pay: '12 400 ₽',
    };

    const NOW = '19:03';
    const TODAY = '17 августа';
    const UNDO_SEC = 5;

    const MODES = [
        { id: 'asis', label: 'Сейчас' },
        { id: 'new', label: 'Предложение' },
    ];

    const state = {
        mode: 'new',
        screen: 'offer',    // offer | accepted | declined | reported | unbound | task
        sheet: null,        // confirm | noContract | report | firstTask
        sheetShown: false,
        confirmed: false,   // водитель ответил, что договор подписан
        gateShown: false,   // напоминание перед первым рейсом уже показывали
        undo: 0,
    };

    const screenEl = document.getElementById('screen');
    const noteEl = document.getElementById('ofNote');
    let undoTimer = null;

    function icon(id, size) {
        const s = size || 24;
        return `<svg width="${s}" height="${s}" aria-hidden="true"><use href="#${id}"/></svg>`;
    }

    // ============================================================
    // Bottom sheet
    // ============================================================
    function openSheet(name) {
        state.sheet = name;
        state.sheetShown = false;
        render();
        requestAnimationFrame(function () {
            state.sheetShown = true;
            const sheet = document.getElementById('ofSheet');
            const backdrop = document.getElementById('ofBackdrop');
            if (sheet) sheet.classList.add('is-open');
            if (backdrop) backdrop.classList.add('is-open');
        });
    }

    function closeSheet(after) {
        const sheet = document.getElementById('ofSheet');
        const backdrop = document.getElementById('ofBackdrop');
        if (sheet) sheet.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
        setTimeout(function () {
            state.sheet = null;
            state.sheetShown = false;
            if (after) after();
            else render();
        }, 260);
    }

    // ============================================================
    // Отмена отклонения. Отказ безопасен и обратим, поэтому вместо
    // диалога подтверждения — короткое окно отмены.
    // ============================================================
    function startUndo() {
        clearInterval(undoTimer);
        state.undo = UNDO_SEC;
        undoTimer = setInterval(function () {
            state.undo -= 1;
            if (state.undo <= 0) clearInterval(undoTimer);
            render();
        }, 1000);
    }

    function stopUndo() {
        clearInterval(undoTimer);
        state.undo = 0;
    }

    // ============================================================
    // Действия
    // ============================================================
    const ACTIONS = {
        // «Сейчас»: принятие одним тапом, без подтверждения и без записи
        acceptNow: function () {
            state.screen = 'accepted';
            render();
        },
        // «Предложение»: тап по «Принять» открывает подтверждение
        askConfirm: function () {
            openSheet('confirm');
        },
        contractYes: function () {
            state.confirmed = true;
            closeSheet(function () {
                state.screen = 'accepted';
                render();
            });
        },
        contractNo: function () {
            // Не наказываем за честный ответ: оффер остаётся, водитель
            // вернётся к нему после подписания договора.
            openSheet('noContract');
        },
        closeSheet: function () {
            closeSheet();
        },
        decline: function () {
            state.screen = 'declined';
            if (state.mode === 'new') startUndo();
            render();
        },
        undoDecline: function () {
            stopUndo();
            state.screen = 'offer';
            render();
        },
        askReport: function () {
            openSheet('report');
        },
        report: function () {
            closeSheet(function () {
                state.screen = 'reported';
                render();
            });
        },
        unbind: function () {
            state.confirmed = false;
            state.screen = 'unbound';
            render();
        },
        toTasks: function () {
            state.screen = 'task';
            render();
            // Гейт перед первым рейсом: там, где появляются деньги и
            // необратимый труд. Показывается один раз на перевозчика.
            if (state.mode === 'new' && !state.gateShown) {
                state.gateShown = true;
                setTimeout(function () { openSheet('firstTask'); }, 320);
            }
        },
        toOffer: function () {
            stopUndo();
            state.screen = 'offer';
            render();
        },
        call: function () {
            // В прототипе набор номера не эмулируем
        },
        noop: function () {},
    };

    screenEl.addEventListener('click', function (e) {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.getAttribute('data-act');
        if (ACTIONS[act]) ACTIONS[act]();
    });

    // ============================================================
    // Общие блоки
    // ============================================================
    function statusbar() {
        return `
            <div class="of-statusbar">
                <span class="of-statusbar__time">${NOW}</span>
                <span class="of-statusbar__icons">
                    <svg width="17" height="13" viewBox="0 0 18 14" aria-hidden="true"><use href="#i-sb-wifi"/></svg>
                    <svg width="17" height="13" viewBox="0 0 18 14" aria-hidden="true"><use href="#i-sb-signal"/></svg>
                    <svg width="11" height="15" viewBox="0 0 12 16" aria-hidden="true"><use href="#i-sb-battery"/></svg>
                </span>
            </div>`;
    }

    function head(title, backAct) {
        return `
            <div class="of-head">
                ${backAct ? `<button class="of-head__back" data-act="${backAct}" aria-label="Назад">${icon('i-back', 26)}</button>` : ''}
                <div class="of-head__title">${title}</div>
            </div>`;
    }

    function bottom(inner) {
        return `<div class="of-bottom">${inner}</div>`;
    }

    function tabbar() {
        return `
            <nav class="of-tabbar">
                <span class="of-tabbar__item is-active">${icon('i-briefcase', 26)}</span>
                <span class="of-tabbar__item">${icon('i-chat', 26)}</span>
                <span class="of-tabbar__item">${icon('i-profile-tab', 26)}</span>
            </nav>`;
    }

    // ============================================================
    // Экран «как сейчас» (воспроизведение продакшена)
    // ============================================================
    function renderAsis() {
        return `
            ${statusbar()}
            ${head('Новый оффер', 'noop')}
            <div class="of-body">
                <div class="of-asis__name">${CARRIER.name}</div>
                <div class="of-asis__inn-cap">ИНН</div>
                <div class="of-asis__inn">${CARRIER.inn}</div>
                <div class="of-banner">
                    ${icon('i-info-filled', 22)}
                    <span>Оплата за задания будет приходить на счёт экспедитора</span>
                </div>
            </div>
            ${bottom(`
                <button class="of-primary" data-act="acceptNow">Принять</button>
                <button class="of-secondary is-danger" data-act="decline">Отказаться</button>
            `)}`;
    }

    // ============================================================
    // Новый экран оффера
    // ============================================================
    function moneyFlow() {
        return `
            <div class="of-flow">
                <div class="of-flow__cap">Как идут деньги за ваши рейсы</div>
                <div class="of-flow__row">
                    <div class="of-flow__step">
                        <span class="of-flow__ico">${icon('i-platform', 21)}</span>
                        <span class="of-flow__name">WB Drive</span>
                        <span class="of-flow__role">даёт задания</span>
                    </div>
                    <span class="of-flow__arr">${icon('i-arrow-right', 18)}</span>
                    <div class="of-flow__step is-key">
                        <span class="of-flow__ico">${icon('i-wallet', 21)}</span>
                        <span class="of-flow__name">Перевозчик</span>
                        <span class="of-flow__role">получает оплату</span>
                    </div>
                    <span class="of-flow__arr">${icon('i-arrow-right', 18)}</span>
                    <div class="of-flow__step">
                        <span class="of-flow__ico">${icon('i-driver', 21)}</span>
                        <span class="of-flow__name">Вы</span>
                        <span class="of-flow__role">по договору</span>
                    </div>
                </div>
            </div>`;
    }

    function renderOffer() {
        return `
            ${statusbar()}
            ${head('Оффер перевозчика', 'noop')}
            <div class="of-body">
                <div class="of-carrier">
                    <span class="of-carrier__ava">${icon('i-company', 24)}</span>
                    <div>
                        <div class="of-carrier__name">${CARRIER.name}</div>
                        <div class="of-carrier__meta">ИНН ${CARRIER.inn}</div>
                        <div class="of-carrier__meta">Приглашение отправлено ${CARRIER.sentAt}</div>
                        <button class="of-call" data-act="call">${icon('i-phone', 18)}<span>${CARRIER.phone}</span></button>
                    </div>
                </div>

                ${moneyFlow()}

                <div class="of-fact">
                    <span class="of-fact__ico">${icon('i-wallet', 22)}</span>
                    <div>
                        <div class="of-fact__title">Деньги за рейсы получает перевозчик</div>
                        <div class="of-fact__text">Он рассчитывается с вами сам — по вашему договору. WB Drive в расчётах не участвует.</div>
                    </div>
                </div>

                <div class="of-fact">
                    <span class="of-fact__ico">${icon('i-doc', 22)}</span>
                    <div>
                        <div class="of-fact__title">Нет договора — не принимайте оффер</div>
                        <div class="of-fact__text">Задание вы выполните, а требовать оплату будет не с кого.</div>
                    </div>
                </div>

                <button class="of-unknown" data-act="askReport">Я не знаю этого перевозчика</button>
            </div>
            ${bottom(`
                <button class="of-primary" data-act="askConfirm">Принять оффер</button>
                <button class="of-secondary" data-act="decline">Отклонить</button>
            `)}`;
    }

    // ============================================================
    // Результаты
    // ============================================================
    function renderAccepted() {
        // В режиме «Сейчас» подтверждения не было, поэтому и квитанции нет:
        // в споре предъявить нечего.
        const receipt = state.confirmed
            ? `<div class="of-receipt">
                    <div class="of-receipt__cap">Вы подтвердили</div>
                    <div class="of-receipt__item">${icon('i-check-circle', 18)}<span>Договор с ${CARRIER.short} подписан</span></div>
                    <div class="of-receipt__item">${icon('i-check-circle', 18)}<span>Оплату за задания получает перевозчик и рассчитывается с вами сам</span></div>
                    <div class="of-receipt__time">${TODAY}, ${NOW} · сохранено в профиле</div>
               </div>`
            : '';

        const unbind = state.mode === 'new'
            ? `<button class="of-ghost" data-act="unbind">Отвязаться от перевозчика</button>`
            : '';

        return `
            ${statusbar()}
            ${head('Оффер принят', 'noop')}
            <div class="of-body">
                <div class="of-result">
                    <span class="of-result__ico">${icon('i-check-filled', 36)}</span>
                    <div class="of-result__title">Вы работаете с ${CARRIER.short}</div>
                    <div class="of-result__text">Оплату за задания получает перевозчик и рассчитывается с вами сам.</div>
                    ${receipt}
                </div>
            </div>
            ${bottom(`
                <button class="of-primary" data-act="toTasks">Перейти к заданиям</button>
                ${unbind}
            `)}`;
    }

    function renderDeclined() {
        return `
            ${statusbar()}
            ${head('Офферы', 'noop')}
            <div class="of-body">
                <div class="of-result">
                    <span class="of-result__ico is-neutral">${icon('i-check-circle', 36)}</span>
                    <div class="of-result__title">Оффер отклонён</div>
                    <div class="of-result__text">Перевозчик увидит отказ и сможет прислать оффер снова.</div>
                </div>
            </div>
            ${bottom('<button class="of-primary" data-act="toOffer">К списку офферов</button>')}`;
    }

    function renderReported() {
        return `
            ${statusbar()}
            ${head('Жалоба отправлена', 'noop')}
            <div class="of-body">
                <div class="of-result">
                    <span class="of-result__ico is-neutral">${icon('i-shield', 36)}</span>
                    <div class="of-result__title">Оффер скрыт</div>
                    <div class="of-result__text">Поддержка проверит, кто отправил приглашение, и свяжется с вами. Принимать оффер не нужно.</div>
                </div>
            </div>
            ${bottom('<button class="of-primary" data-act="toOffer">К списку офферов</button>')}`;
    }

    function renderUnbound() {
        return `
            ${statusbar()}
            ${head('Перевозчик', 'noop')}
            <div class="of-body">
                <div class="of-result">
                    <span class="of-result__ico is-neutral">${icon('i-check-circle', 36)}</span>
                    <div class="of-result__title">Вы отвязались от перевозчика</div>
                    <div class="of-result__text">Заданий от ${CARRIER.short} больше не будет. Оффер снова доступен — примете, когда подпишете договор.</div>
                </div>
            </div>
            ${bottom('<button class="of-primary" data-act="toOffer">К офферу</button>')}`;
    }

    function renderTask() {
        return `
            ${statusbar()}
            ${head('Задание', 'noop')}
            <div class="of-body">
                <div class="of-task">
                    <div class="of-task__title">${TASK.title}</div>
                    <div class="of-task__row">${icon('i-company', 22)}<span>${TASK.point}</span></div>
                    <div class="of-task__row">${icon('i-box', 22)}<span>${TASK.cargo}</span></div>
                    <div class="of-task__pay">
                        <span>Оплата перевозчику</span>
                        <b>${TASK.pay}</b>
                    </div>
                </div>
            </div>
            ${bottom('<button class="of-primary" data-act="noop">Начать задание</button>')}
            ${tabbar()}`;
    }

    // ============================================================
    // Шиты
    // ============================================================
    function sheetConfirm() {
        return `
            <div class="of-sheet__title">Деньги придут перевозчику</div>
            <div class="of-sheet__list">
                <div class="of-sheet__li">
                    ${icon('i-wallet', 20)}
                    <span>Оплату за ваши рейсы WB Drive перечисляет ${CARRIER.short}. Перевозчик рассчитывается с вами сам — по вашему договору.</span>
                </div>
                <div class="of-sheet__li">
                    ${icon('i-alert', 20)}
                    <span>Если договора нет, требовать оплату будет не с кого: WB Drive в расчётах не участвует.</span>
                </div>
            </div>
            <div class="of-sheet__q">Вы подписали договор с ${CARRIER.short}?</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="contractYes">Да, договор подписан</button>
                <button class="of-sheet__ghost" data-act="contractNo">Нет, ещё не подписал</button>
            </div>`;
    }

    function sheetNoContract() {
        return `
            <div class="of-sheet__title">Сначала договор</div>
            <div class="of-sheet__text">Не принимайте оффер, пока не подписали договор с перевозчиком: без него вы не сможете получить оплату за выполненные задания.</div>
            <div class="of-sheet__text">Оффер никуда не денется — примете, когда подпишете.</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="closeSheet">Понятно</button>
                <button class="of-sheet__ghost" data-act="call">Позвонить перевозчику</button>
            </div>`;
    }

    function sheetReport() {
        return `
            <div class="of-sheet__title">Не знаете этого перевозчика?</div>
            <div class="of-sheet__text">Если вы не договаривались о работе с ${CARRIER.short}, не принимайте оффер. Мы скроем его и передадим в поддержку — она проверит, кто и зачем отправил приглашение.</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="report">Скрыть и пожаловаться</button>
                <button class="of-sheet__ghost" data-act="closeSheet">Отмена</button>
            </div>`;
    }

    function sheetFirstTask() {
        return `
            <div class="of-sheet__title">Первый рейс с этим перевозчиком</div>
            <div class="of-sheet__text">Оплату за задание получит ${CARRIER.short} и рассчитается с вами по вашему договору. WB Drive в расчётах между вами не участвует.</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="closeSheet">Понятно, начинаю</button>
                <button class="of-sheet__ghost" data-act="toOffer">Отказаться от задания</button>
            </div>`;
    }

    function renderSheet() {
        if (!state.sheet) return '';
        const inner = state.sheet === 'confirm' ? sheetConfirm()
            : state.sheet === 'noContract' ? sheetNoContract()
            : state.sheet === 'report' ? sheetReport()
            : sheetFirstTask();
        const openCls = state.sheetShown ? ' is-open' : '';
        return `
            <div class="of-backdrop${openCls}" id="ofBackdrop" data-act="closeSheet"></div>
            <div class="of-sheet${openCls}" id="ofSheet" role="dialog">
                <div class="of-sheet__handle"></div>
                ${inner}
            </div>`;
    }

    function renderSnack() {
        if (state.screen !== 'declined' || state.undo <= 0) return '';
        return `
            <div class="of-snack">
                <span>Отклонено</span>
                <button class="of-snack__undo" data-act="undoDecline">Вернуть · ${state.undo}</button>
            </div>`;
    }

    // ============================================================
    // Рендер
    // ============================================================
    function render() {
        let body;
        if (state.screen === 'accepted') body = renderAccepted();
        else if (state.screen === 'declined') body = renderDeclined();
        else if (state.screen === 'reported') body = renderReported();
        else if (state.screen === 'unbound') body = renderUnbound();
        else if (state.screen === 'task') body = renderTask();
        else body = state.mode === 'asis' ? renderAsis() : renderOffer();

        screenEl.innerHTML = `
            <div class="of-screen">
                ${body}
                ${renderSnack()}
                ${renderSheet()}
                <span class="of-home"></span>
            </div>`;
        renderDemo();
    }

    // ============================================================
    // Демо-панель
    // ============================================================
    function resetFlow() {
        stopUndo();
        state.screen = 'offer';
        state.sheet = null;
        state.sheetShown = false;
        state.confirmed = false;
        state.gateShown = false;
    }

    // Пояснение к текущему состоянию: демо смотрят без ведущего
    function note() {
        if (state.sheet === 'confirm') return 'Раскрытие в момент интента: не текст рядом с кнопкой, а вопрос, на который надо ответить. У обоих ответов есть осмысленный результат, поэтому врать незачем.';
        if (state.sheet === 'noContract') return 'Честный ответ ничего не отнимает: оффер остаётся, водитель вернётся к нему после подписания договора.';
        if (state.sheet === 'report') return 'Аварийный выход. В инциденте он был нужен именно этому водителю, а нам даёт сигнал для детекта массовых рассылок.';
        if (state.sheet === 'firstTask') return 'Вторая линия защиты: напоминание там, где появляются деньги и необратимый труд. Один раз на перевозчика.';
        if (state.screen === 'accepted') {
            return state.confirmed
                ? 'Квитанция: что именно подтвердил водитель и когда. Это артефакт для спора — без версии показанного текста «информированное согласие» недоказуемо.'
                : 'Так работает продакшен: одним тапом водитель привязан к перевозчику. Ни подтверждения, ни записи о том, что он понимал условия.';
        }
        if (state.screen === 'declined') return state.mode === 'asis'
            ? 'В продакшене отказ покрашен красным, будто он опасен, — и водитель выбирает «Принять».'
            : 'Отказ безопасен и обратим: вместо диалога подтверждения — короткая отмена в снекбаре.';
        if (state.screen === 'reported') return 'Жалоба закрывает оффер для водителя и даёт антифроду сигнал о рассылке.';
        if (state.screen === 'unbound') return 'Окно для исправления ошибки: пока первое задание не начато, привязку можно снять.';
        if (state.screen === 'task') return 'Задание от перевозчика. Оплата уходит ему — на экране это названо прямо.';
        if (state.mode === 'asis') return 'Экран продакшена. Плашка про счёт экспедитора здесь уже есть — и она не сработала: сноска того же оттенка, что кнопка, а красный отказ отпугивает от безопасного выхода.';
        return 'Предложение: перевозчик опознаваем (телефон, дата приглашения), схема денег — содержание экрана, а не сноска. Красный снят с отказа.';
    }

    function renderDemo() {
        const modeWrap = document.getElementById('ofModeBtns');
        const actionWrap = document.getElementById('ofActionBtns');

        modeWrap.innerHTML = MODES.map(function (m) {
            return `<button class="of-demo__btn${m.id === state.mode ? ' is-active' : ''}" data-mode="${m.id}">${m.label}</button>`;
        }).join('');

        const atStart = state.screen === 'offer' && !state.sheet;
        actionWrap.innerHTML =
            `<button class="of-demo__btn is-ghost" data-reset="1"${atStart ? ' disabled' : ''}>Сброс</button>`;

        noteEl.textContent = note();

        modeWrap.querySelectorAll('[data-mode]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.mode = btn.getAttribute('data-mode');
                resetFlow();
                render();
            });
        });
        actionWrap.querySelector('[data-reset]').addEventListener('click', function () {
            resetFlow();
            render();
        });
    }

    render();
})();
