import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/CreateGameUI.css";

class GameUI extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <form onSubmit={this.props.onSubmit}>
        <div className="question">
          <input id="playerCount" type="number" required min="2" max="100" defaultValue="2"/>
          <label># OF PLAYERS</label>
        </div>
        <button>CREATE GAME</button>
      </form>
    )
  }
}

export default hot(module)(GameUI);
