import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { TravelAttachmentsService } from './travel-attachments.service';
import { IsString, MaxLength } from 'class-validator';

class UploadAttachmentDto {
  @IsString() @MaxLength(120) filename: string;
  @IsString() @MaxLength(100) mimeType: string;
  @IsString() @MaxLength(2796204) base64: string;
}

@Controller('ops')
@UseGuards(JwtAuthGuard)
export class TravelAttachmentsController {
  constructor(private readonly attachments: TravelAttachmentsService) {}

  @Post('messages/:id/attachments')
  upload(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UploadAttachmentDto,
  ) {
    return this.attachments.upload(req.user.userId, id, body);
  }

  @Get('messages/:id/attachments')
  list(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attachments.list(req.user.userId, id);
  }

  @Post('attachments/:id/download-link')
  link(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attachments.link(req.user.userId, id);
  }

  @Get('attachments/:id/download')
  async download(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
  ) {
    const row = await this.attachments.download(
      req.user.userId,
      id,
      expires,
      signature,
    );
    res.setHeader('Content-Type', row.mimeType);
    res.setHeader('Content-Length', row.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/'/g, '%27')}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(Buffer.from(row.bytes));
  }
}
