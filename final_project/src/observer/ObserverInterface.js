export class ObserverInterface {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
  }

  async executeAction(action) {
    // Validate that it's the observer's turn
    if (!this.gameEngine.gameState.isObserverTurn()) {
      throw new Error('Not the observer\'s turn');
    }

    // Execute the observer action
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