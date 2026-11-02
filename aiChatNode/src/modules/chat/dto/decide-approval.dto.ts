import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DecideApprovalDto {
  @ApiProperty({
    description: '裁决决策: approved (允许) 或 rejected (拒绝)',
    enum: ['approved', 'rejected'],
    example: 'approved',
  })
  @IsNotEmpty({ message: '决策不能为空' })
  @IsIn(['approved', 'rejected'], { message: '决策必须为 approved 或 rejected' })
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: '决策说明或拒绝理由',
    example: '经操作者核验，允许执行代码解释器',
  })
  @IsOptional()
  @IsString({ message: '决策理由必须是字符串' })
  reason?: string;
}
