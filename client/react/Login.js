import React, { Component } from "react";
import { hot } from "react-hot-loader";
import "../css/CreateGameUI.css";

class Login extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <form onSubmit={this.props.onSubmit}>
        <div className="question">
          <input id="inGameName" type="text" required maxLength="10"/>
          <label>IN GAME NAME</label>
        </div>
        <button id="submitInGameName">SUBMIT</button>
      </form>
    )
  }
}

export default hot(module)(Login);
