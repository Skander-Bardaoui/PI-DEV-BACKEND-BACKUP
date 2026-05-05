import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface FraudResult {
  fraud_score: number;
  is_fraud:    boolean;
  confidence:  'low' | 'medium' | 'high';
  action:      'block' | 'flag' | 'allow';
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);
  private readonly mlUrl:  string;

  constructor(
    private readonly http:   HttpService,
    private readonly config: ConfigService,
  ) {
    this.mlUrl = this.config.get('ML_SERVICE_URL', 'http://localhost:8000');
  }

  async evaluate(transaction: {
    amount: number;
    type?:  string;
    transaction_date?: Date;
  }): Promise<FraudResult> {
    const date      = transaction.transaction_date || new Date();
    const hour      = date.getHours();
    const isWeekend = [0, 6].includes(date.getDay()) ? 1 : 0;
    const isNight   = (hour >= 22 || hour < 6) ? 1 : 0;

    try {
      const { data } = await firstValueFrom(
        this.http.post<FraudResult>(
          `${this.mlUrl}/api/v1/predict/fraud`,
          {
            amount:                   transaction.amount,
            transaction_type:         transaction.type,
            hour,
            is_weekend:               isWeekend,
            is_night:                 isNight,
            velocity_score:           0.0,
            geo_anomaly_score:        0.0,
            spending_deviation_score: 0.0,
          },
          { timeout: 3000 },
        ),
      );
      
      this.logger.log(
        `Fraud check: amount=${transaction.amount}, score=${data.fraud_score}, action=${data.action}`
      );
      
      return data;

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `ML service unreachable, skipping fraud check: ${message}`
      );
      return {
        fraud_score: 0,
        is_fraud:    false,
        confidence:  'low',
        action:      'allow',
      };
    }
  }
}
