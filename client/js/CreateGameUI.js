import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/CreateGameUI.css";

class CreateGameUI extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <form>
        <div className="question">
          <input id="playerCount" type="number" required min="2" max="100" defaultValue="2"/>
          <label>Number Of Players</label>
        </div>
        <button onClick={this.props.onClick}>Submit</button>
      </form>
    )
  }
}

export default hot(module)(CreateGameUI);
