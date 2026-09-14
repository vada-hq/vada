export interface Requester {
  memberId: string
}

export interface DraftItem {
  itemName: string
  itemCategory: string
  budgetItem: string
  purchaseType: string
  quantity?: number
  unit: string
  unitPrice?: number
  vendor?: string
  productUrl?: string
  option?: string
  deliveryNote?: string
  quoteStatus: string
}

export interface PurchaseDraft {
  title: string
  department: string
  neededOn: string
  priority: string
  purpose: string
  items: DraftItem[]
}
