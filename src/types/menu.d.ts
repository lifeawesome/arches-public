export type MenuItemType = {
  name: string;
  path: string;
  hidden?: boolean;
  dropdown?: {
    name: string;
    path: string;
  }[];
};
