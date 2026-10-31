import { ApiProperty } from '@nestjs/swagger';

export class BrandOptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  toneTags?: string[];

  @ApiProperty({ required: false })
  primaryColor?: string;
}

