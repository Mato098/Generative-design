export class ObserverInterface {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
  }

  async executeAction(action) {
    // Observer can act anytime - no turn validation needed
    // Execute the observer action (handles queueing/interruption internally)
    return await this.gameEngine.executeObserverAction(action);
  }

  getAvailableActions() {
    return [
      'Smite', 'Bless', 'Sanctify', 'Rend', 'Meteor', 'Observe'
    ];
  }

  getCurrentGameState() {
    return this.gameEngine.getState();
  }
}