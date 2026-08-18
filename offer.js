// ============================================================
// WB Drive · Прототип принятия оффера перевозчика
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
        sentAt: '17 августа',
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
        // «Сейчас»: отказ одним тапом, красной кнопкой и без пути назад
        decline: function () {
            state.screen = 'declined';
            render();
        },
        askDecline: function () {
            openSheet('decline');
        },
        // Отказ обратим, поэтому подтверждения нет — есть отмена
        declineTerms: function () {
            closeSheet(function () {
                state.screen = 'declined';
                startUndo();
                render();
            });
        },
        declineLater: function () {
            ACTIONS.declineTerms();
        },
        declineUnknown: function () {
            closeSheet(function () {
                state.screen = 'reported';
                render();
            });
        },
        undoDecline: function () {
            stopUndo();
            state.screen = 'offer';
            render();
        },
        howPay: function () {
            openSheet('howPay');
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
                <div class="of-flow__cap">Как идут деньги за выполненную перевозку</div>
                <div class="of-flow__row">
                    <div class="of-flow__step">
                        <span class="of-flow__ico">${icon('i-platform', 21)}</span>
                        <span class="of-flow__name">WB Drive</span>
                        <span class="of-flow__role">перечисляет</span>
                    </div>
                    <span class="of-flow__arr">${icon('i-arrow-right', 18)}</span>
                    <div class="of-flow__step is-key">
                        <span class="of-flow__ico">${icon('i-wallet', 21)}</span>
                        <span class="of-flow__name">Перевозчик</span>
                        <span class="of-flow__role">получает</span>
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

    // Перевозчик — предмет экрана, поэтому его название заголовок, а не
    // карточка. Оба положения legal — один блок из двух строк, подробности
    // и схема уехали в справку по ссылке: на первом экране нужна суть, а не
    // весь текст сразу.
    function renderOffer() {
        return `
            ${statusbar()}
            ${head('Новый оффер', 'noop')}
            <div class="of-body">
                <h1 class="of-title">${CARRIER.name}</h1>
                <div class="of-meta">ИНН ${CARRIER.inn} · приглашение ${CARRIER.sentAt}</div>

                <div class="of-note">
                    <p class="of-note__p">Оплату за выполненные перевозки получает перевозчик — он рассчитывается с вами сам.</p>
                    <p class="of-note__p">Не принимайте оффер, пока не подписали с ним договор.</p>
                    <button class="of-note__more" data-act="howPay">
                        <span>Как устроена оплата</span>
                        ${icon('i-chevron', 20)}
                    </button>
                </div>
            </div>
            ${bottom(`
                <button class="of-primary" data-act="askConfirm">Принять оффер</button>
                <button class="of-secondary" data-act="askDecline">Отклонить</button>
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
                    <div class="of-receipt__item">${icon('i-check-circle', 18)}<span>Оплату за выполненные перевозки получает перевозчик и рассчитывается с вами сам</span></div>
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
                    <div class="of-result__text">Оплату за выполненные перевозки получает перевозчик и рассчитывается с вами сам.</div>
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
            ${head('Офферы', 'noop')}
            <div class="of-body">
                <div class="of-result">
                    <span class="of-result__ico is-neutral">${icon('i-shield', 36)}</span>
                    <div class="of-result__title">Оффер отклонён</div>
                    <div class="of-result__text">Мы передали в поддержку, что приглашение пришло от незнакомого перевозчика. Она проверит, кто его отправил.</div>
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
            <div class="of-sheet__text">После выполненной перевозки оплату получает ${CARRIER.short} и рассчитывается с вами сам — по вашему договору или иным договорённостям между вами.</div>
            <div class="of-sheet__text">Без договора у вас не будет оснований требовать оплату.</div>
            <div class="of-sheet__q">Вы подписали договор с ${CARRIER.short}?</div>
            <div class="of-sheet__hint">В вашем договоре должен стоять ИНН ${CARRIER.inn}</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="contractYes">Да, договор подписан</button>
                <button class="of-sheet__ghost" data-act="contractNo">Нет, ещё не подписал</button>
            </div>`;
    }

    function sheetNoContract() {
        return `
            <div class="of-sheet__title">Сначала договор</div>
            <div class="of-sheet__text">Не принимайте оффер, пока не подписали договор с перевозчиком: без него вы не сможете получить оплату за выполненные перевозки.</div>
            <div class="of-sheet__text">Оффер никуда не денется — примете, когда подпишете.</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="closeSheet">Понятно</button>
            </div>`;
    }

    // Справка: схема живёт здесь, а не на первом экране. Кому нужна
    // картинка — откроет, остальным она не мешает читать главное.
    function sheetHowPay() {
        return `
            <div class="of-sheet__title">Как устроена оплата</div>
            ${moneyFlow()}
            <div class="of-sheet__text">После выполненной перевозки WB Drive перечисляет оплату ${CARRIER.short} Перевозчик рассчитывается с вами по вашему договору или иным договорённостям между вами — WB Drive в этих расчётах не участвует.</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="closeSheet">Понятно</button>
            </div>`;
    }

    // Причина отказа вместо отдельной ссылки «я не знаю перевозчика»:
    // экран теряет элемент, а антифрод получает сигнал.
    function sheetDecline() {
        return `
            <div class="of-sheet__title">Почему отклоняете?</div>
            <div class="of-choices">
                <button class="of-choice" data-act="declineUnknown">Это не мой перевозчик</button>
                <button class="of-choice" data-act="declineTerms">Не подходят условия</button>
                <button class="of-choice" data-act="declineLater">Пока не готов принять</button>
            </div>
            <div class="of-sheet__actions">
                <button class="of-sheet__ghost" data-act="closeSheet">Отмена</button>
            </div>`;
    }

    function sheetFirstTask() {
        return `
            <div class="of-sheet__title">Первый рейс с этим перевозчиком</div>
            <div class="of-sheet__text">После выполненной перевозки оплату получит ${CARRIER.short} Он рассчитается с вами по вашему договору или иным договорённостям между вами.</div>
            <div class="of-sheet__actions">
                <button class="of-primary" data-act="closeSheet">Понятно, начинаю</button>
                <button class="of-sheet__ghost" data-act="toOffer">Отказаться от задания</button>
            </div>`;
    }

    function renderSheet() {
        if (!state.sheet) return '';
        const inner = state.sheet === 'confirm' ? sheetConfirm()
            : state.sheet === 'noContract' ? sheetNoContract()
            : state.sheet === 'howPay' ? sheetHowPay()
            : state.sheet === 'decline' ? sheetDecline()
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
        if (state.sheet === 'howPay') return 'Подробности и схема живут в справке, а не на первом экране: кому нужна картинка — откроет, остальным она не мешает читать главное.';
        if (state.sheet === 'decline') return 'Причина вместо отдельной ссылки «я не знаю перевозчика»: экран теряет элемент, а «это не мой перевозчик» становится сигналом для детекта массовых рассылок.';
        if (state.sheet === 'firstTask') return 'Вторая линия защиты: напоминание там, где появляются деньги и необратимый труд. Один раз на перевозчика.';
        if (state.screen === 'accepted') {
            return state.confirmed
                ? 'Квитанция: что именно подтвердил водитель и когда. Это артефакт для спора — без версии показанного текста «информированное согласие» недоказуемо.'
                : 'Так работает продакшен: одним тапом водитель привязан к перевозчику. Ни подтверждения, ни записи о том, что он понимал условия.';
        }
        if (state.screen === 'declined') return state.mode === 'asis'
            ? 'В продакшене отказ покрашен красным, будто он опасен, — и водитель выбирает «Принять».'
            : 'Отказ безопасен и обратим: вместо диалога подтверждения — короткая отмена в снекбаре.';
        if (state.screen === 'reported') return 'Отказ с причиной «не мой перевозчик» закрывает оффер и даёт антифроду сигнал о рассылке.';
        if (state.screen === 'unbound') return 'Окно для исправления ошибки: пока первое задание не начато, привязку можно снять.';
        if (state.screen === 'task') return 'Задание от перевозчика. Оплата уходит ему — на экране это названо прямо.';
        if (state.mode === 'asis') return 'Текущий экран. Плашка про счёт экспедитора здесь уже есть, но читается как декор: тот же оттенок, что у кнопки, а красный отказ отпугивает от безопасного выхода.';
        return 'Предложение: перевозчик — заголовок экрана, оба положения legal — один блок из двух строк, подробности по ссылке. Красный снят с отказа, контактов перевозчика до принятия нет: это персональные данные.';
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
