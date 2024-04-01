import { Market } from "@project-serum/serum";

import {
  calculateTotalAccountSize,
  EVENT_QUEUE_HEADER_SIZE,
  EVENT_SIZE, ORDERBOOK_HEADER_SIZE, ORDERBOOK_NODE_SIZE,
  REQUEST_QUEUE_HEADER_SIZE,
  REQUEST_SIZE
} from './serum'
import { useRentExemption } from './useRentExemption'
import { programID } from '../openMarket'

type useSerumMarketAccountSizesProps = {
  eventQueueLength: number;
  requestQueueLength: number;
  orderbookLength: number;
};
export async function useSerumMarketAccountSizes({
  eventQueueLength,
  requestQueueLength,
  orderbookLength,
}: useSerumMarketAccountSizesProps) {

  const totalEventQueueSize =
      calculateTotalAccountSize(
        eventQueueLength,
        EVENT_QUEUE_HEADER_SIZE,
        EVENT_SIZE
      )

  const totalRequestQueueSize =
      calculateTotalAccountSize(
        requestQueueLength,
        REQUEST_QUEUE_HEADER_SIZE,
        REQUEST_SIZE
      )

  const totalOrderbookSize =
      calculateTotalAccountSize(
        orderbookLength,
        ORDERBOOK_HEADER_SIZE,
        ORDERBOOK_NODE_SIZE
      )
  console.log(totalOrderbookSize)
  const marketAccountRent = await useRentExemption(Market.getLayout(programID).span);
  const eventQueueRent = await  useRentExemption(totalEventQueueSize);
  const requestQueueRent= await useRentExemption(totalRequestQueueSize);
  const orderbookRent = await useRentExemption(totalOrderbookSize);

  return {
    marketRent:
      marketAccountRent + eventQueueRent + requestQueueRent + 2 * orderbookRent,
    totalEventQueueSize,
    totalRequestQueueSize,
    totalOrderbookSize,
  };
}
