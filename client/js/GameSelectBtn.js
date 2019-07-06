import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/GameSelectBtn.css";

class GameSelectBtn extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="GameSelectBtn">
        <div>
          <button onClick={this.props.quickMatchOnClick}>Quick Match</button>
        </div>
        <div>
          <button onClick={this.props.singlePlayerOnClick}>Single Player</button>
        </div>
      </div>
    );
  }
}

export default hot(module)(GameSelectBtn);
