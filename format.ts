import { TxInfo, Event } from "@terra-money/terra.js"
import { ReturningLogFinderResult } from "@terra-money/log-finder"
import { collector } from "./collector"
import {
  LogFinderActionResult,
  LogFinderAmountResult,
  Amount,
  Action,
} from "./types"
import { defaultAction, formatLogs } from "./utility"

export const getTxCanonicalMsgs = (
  data: string,
  logMatcher: (events: Event[]) => ReturningLogFinderResult<Action>[][]
): LogFinderActionResult[][] => {
  try {
    const tx: TxInfo.Data = JSON.parse(data)
    const isSuccess = !tx.code

    if (tx.logs && isSuccess) {
      const matched: LogFinderActionResult[][] = tx.logs.map((log) => {
        const matchLog = logMatcher(log.events)
        const matchedPerLog: LogFinderActionResult[] = matchLog
          ?.flat()
          .filter(Boolean)
          .map((data) => ({ ...data, timestamp: tx.timestamp }))
        return matchedPerLog
      })

      const logMatched = matched.map((match) => collector(match, tx))

      if (!(logMatched.flat().length > 0)) {
        const defaultCanonicalMsg = defaultAction(tx)
        return [defaultCanonicalMsg]
      }

      return logMatched
    } else {
      //failed transaction or log is null (old network)
      const msgs = tx.tx.value.msg
      const msgTypes = msgs[0].type.split("/")
      const fragment = {
        type: `terra/${msgTypes[0] || "Unknown"}`,
        attributes: [],
      }
      const transformed: Action = {
        msgType: `terra/${msgTypes[0] || "terra"}`,
        canonicalMsg: [msgTypes[1] || "Unknown tx"],
        payload: fragment,
      }

      return [[{ fragment, match: [], transformed }]]
    }
  } catch {
    const fragment = {
      type: "Unknown",
      attributes: [],
    }
    const transformed: Action = {
      msgType: "unknown/terra",
      canonicalMsg: ["Unknown tx"],
      payload: fragment,
    }

    return [[{ fragment, match: [], transformed }]]
  }
}

export const getTxAmounts = (
  data: string,
  logMatcher: (events: Event[]) => ReturningLogFinderResult<Amount>[][],
  address: string
): LogFinderAmountResult[][] | undefined => {
  try {
    const tx: TxInfo.Data = JSON.parse(data)
    if (tx.logs) {
      const msgTypes = tx.tx.value.msg
      const { timestamp, txhash } = tx

      const matched: LogFinderAmountResult[][] = tx.logs.map((log, index) => {
        const matchLog = logMatcher(log.events)
        const matchedPerLog: LogFinderAmountResult[] = matchLog
          ?.flat()
          .filter(Boolean)
          .map((data) => {
            const msgType = msgTypes[index].type.split("/")[1]
            return formatLogs(data, msgType, address, timestamp, txhash)
          })

        return matchedPerLog
      })

      return matched.flat().length > 0 ? matched : undefined
    }
  } catch {
    return undefined
  }
}
