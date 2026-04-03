export type ThemeMode = "LIGHT" | "DARK" | "SYSTEM";

export type ItemStatus = "IN_USE" | "IDLE" | "REPLACE_SOON" | "RESTOCK_SOON";

export interface ItemView {
  id: number;
  name: string;
  price: number;
  purchaseDate: string;
  daysOwned: number;
  dailyCost: number;
  status: ItemStatus;
}
