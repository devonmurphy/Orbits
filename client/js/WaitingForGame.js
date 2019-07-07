import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/GameSelectBtn.css";

class WaitingForGame extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (this.props.currentPlayers && this.props.maxPlayers) {
      return (
        <div className="waitingForGame">
          <div>
            <b>WAITING FOR OPPONENTS...</b>
          </div>
          <div>
            <b>{this.props.currentPlayers}/{this.props.maxPlayers}</b>
          </div>
          }
        <div>
            <c>{this.props.gameLink}</c>
          </div>
        </div>
      )
    } else {
      return (
        <div>
          <b>WAITING FOR OPPONENTS...</b>
        </div>
      )
    }
  }
}

export default hot(module)(WaitingForGame);
