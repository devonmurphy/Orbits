import React, { Component} from "react";
import {hot} from "react-hot-loader";
import "../css/App.css";

class App extends Component{
  render(){
    return(
      <div className="App">
        <button>Quick Match</button>
      </div>
    );
  }
}

export default hot(module)(App);
