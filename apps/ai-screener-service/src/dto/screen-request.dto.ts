import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class ScreenRequestDto {
  @ApiProperty({ description: 'Application UUID to screen' })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ description: 'Job title' })
  @IsString()
  @IsNotEmpty()
  jobTitle: string;

  @ApiProperty({ description: 'Full job description' })
  @IsString()
  @IsNotEmpty()
  jobDescription: string;

  @ApiProperty({ description: 'Job requirements text' })
  @IsString()
  @IsNotEmpty()
  jobRequirements: string;

  @ApiProperty({ description: 'Extracted resume text content' })
  @IsString()
  @IsNotEmpty()
  resumeText: string;
}
