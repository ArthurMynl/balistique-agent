import { Console } from "effect"
import { NodeRuntime } from "@effect/platform-node"

const program = Console.log("Hello from Balistique Agent")

NodeRuntime.runMain(program)
