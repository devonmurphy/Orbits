import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/GameSelectBtn.css";

class GameSelectBtns extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="GameSelectBtns">
        <div>
          <button onClick={this.props.quickMatchOnClick}><a>QUICK MATCH</a></button>
        </div>
        <div>
          <button onClick={this.props.singlePlayerOnClick}><a>SINGLE PLAYER</a></button>
        </div>
        <div>
          <button onClick={this.props.createGameOnClick}><a>CREATE GAME</a></button>
        </div>
      </div>
    );
  }
}

export default hot(module)(GameSelectBtns);
