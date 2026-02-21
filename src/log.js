function emit(state, event) {
  state.log.push(event);
}

function logAction(state, actor, action, details = {}) {
  emit(state, { type: 'action', actor, action, ...details });
}

function logInterrupt(state, actor, interrupt, details = {}) {
  emit(state, { type: 'interrupt', actor, interrupt, ...details });
}

function logDamage(state, target, amount, details = {}) {
  emit(state, { type: 'damage', target, amount, ...details });
}

function logEvent(state, eventName, details = {}) {
  emit(state, { type: 'event', event: eventName, ...details });
}

module.exports = { emit, logAction, logInterrupt, logDamage, logEvent };
