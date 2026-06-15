import { Context } from 'koishi';
import { Config } from '../config';
import { XiuxianExercises } from '../types';
declare module 'koishi' {
    interface Tables {
        xiuxian_exercises: XiuxianExercises;
    }
}
interface ExerciseLevelDef {
    name: string;
    costStone: number;
    atkBuff: number;
    defBuff: number;
    critBuff: number;
    critDmgBuff: number;
    probability: number;
}
declare const EXERCISE_LEVELS: ExerciseLevelDef[];
/** 炼体系统 */
export declare function applyExercises(ctx: Context, _config: Config): void;
export { EXERCISE_LEVELS };
//# sourceMappingURL=exercises.d.ts.map