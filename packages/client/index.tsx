import "@barlus/runtime";
import * as React    from "@barlus/react";
import {App} from "./components/App";

async function main() {
  // const authStore = new AuthStore();
  // const viewStore = new ViewStore();
  React.render(
    <App/>,
    document.getElementById('root')
  );
}

main().catch(ex => console.error(ex));