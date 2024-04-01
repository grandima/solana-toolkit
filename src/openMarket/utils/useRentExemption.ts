import { connection } from '../../../config'

export async function useRentExemption(accountSize: number) {
  if (!accountSize) {
    return 0
  }
  return await connection.getMinimumBalanceForRentExemption(accountSize)
}