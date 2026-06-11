export type BattleDetailKind = 'rob' | 'boss';
export interface BattleDetailRecord {
    kind: BattleDetailKind;
    userId: string;
    otherId?: string;
    bossId?: number;
    detail: string;
    expireAt: number;
}
export declare function storeBattleDetail(record: Omit<BattleDetailRecord, 'expireAt'>): void;
export declare function getBattleDetail(userId: string, kind?: BattleDetailKind): BattleDetailRecord | undefined;
export declare const BATTLE_DETAIL_HINT = "120\u79D2\u5185\u53EF\u56DE\u590D\u3010\u67E5\u770B\u6218\u6597\u8BE6\u60C5\u3011\u67E5\u770B\u6218\u6597\u8FC7\u7A0B\u3002";
//# sourceMappingURL=battle-detail.d.ts.map