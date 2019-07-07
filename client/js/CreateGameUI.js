import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/GameSelectBtn.css";

class CreateGameUI extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="CreateGameUI">
        <div>
          <input id="gameName"><a>Game Name</a></input>
        </div>
        <div>
          <input id="playerCount" type="number"><a>Number of Players</a></input>
        </div>
        <div>
          <button onClick={this.props.submitOnClick}><a>Submit</a></button>
        </div>
      </div>
    );
  }
}

export default hot(module)(CreateGameUI);
