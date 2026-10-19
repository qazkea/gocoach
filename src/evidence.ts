import type {Color,EngineInput,EngineResult} from './engine';
export type AnalyzedResult=EngineResult&{evidenceId:string};
export type EvidenceAnalysis=EngineResult&{candidateCount:number;budget:{version:1;maxVisits:100;maxTime:2}};
export interface ReviewEvidence {
 version:1;
 limitations:string[];
 step:number;
 nextPlayer:Color;
 initialStones:number;
 actual:{color:Color;move:string;captured:string[];liberties:string[]|null}|null;
 before:EvidenceAnalysis|null;
 after:EvidenceAnalysis;
 decline:{winratePoints:number;scoreLead:number}|null;
}
export interface EvidenceRequest {position:EngineInput;afterId:string;beforeId?:string}
