import { Context } from 'koishi';
import { ItemInfo, XiuxianBack } from './types';
import type { XiuxianService } from './service';
export type ItemUseCategory = 'equipment' | 'skill' | 'elixir' | 'jlq' | 'other';
/** 根据物品数据判定使用类别（兼容背包中历史的 goodsType 字段） */
export declare function getItemUseCategory(info: ItemInfo, back?: XiuxianBack): ItemUseCategory;
export declare function useBackItem(ctx: Context, srv: XiuxianService, userId: string, back: XiuxianBack, info: ItemInfo, useNum?: number): Promise<string>;
export declare function unequipItem(ctx: Context, srv: XiuxianService, userId: string, back: XiuxianBack, info: ItemInfo): Promise<string>;
