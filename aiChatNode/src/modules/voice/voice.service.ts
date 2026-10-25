import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { VoiceTask } from './entities/voice-task.entity';
import { CreateTtsDto, QueryVoiceHistoryDto } from './dto/voice.dto';
import { CreditsService } from '../credits/credits.service';
import { CreditBusinessType } from '../credits/types/credits.types';

export interface VoiceItem {
  voice_id: string;
  name: string;
  language: string;
  gender?: string;
  category?: string;
  description?: string;
}

export const EDGE_VOICES: VoiceItem[] = [
  // 中文普通话 (精品)
  { voice_id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声·温柔亲切)', language: 'zh-CN', gender: 'Female', category: '中文普通话 (精品)', description: '通用朗读标杆，自然亲切' },
  { voice_id: 'zh-CN-YunxiNeural', name: '云希 (男声·阳光沉稳)', language: 'zh-CN', gender: 'Male', category: '中文普通话 (精品)', description: '短视频科普与解说专用' },
  { voice_id: 'zh-CN-YunjianNeural', name: '云健 (男声·深沉浑厚)', language: 'zh-CN', gender: 'Male', category: '中文普通话 (精品)', description: '影视解说、纪录片沉浸朗读' },
  { voice_id: 'zh-CN-XiaoyiNeural', name: '晓伊 (女声·活泼生活)', language: 'zh-CN', gender: 'Female', category: '中文普通话 (精品)', description: '日常陪伴、活泼轻快' },
  { voice_id: 'zh-CN-YunyangNeural', name: '云扬 (男声·专业严肃)', language: 'zh-CN', gender: 'Male', category: '中文普通话 (精品)', description: '新闻播报、庄重大气' },
  { voice_id: 'zh-CN-YunxiaNeural', name: '云夏 (男声·清澈少年)', language: 'zh-CN', gender: 'Male', category: '中文普通话 (精品)', description: '清澈活力少年音，动漫朗读' },

  // 中文方言 / 地方语言
  { voice_id: 'zh-CN-liaoning-XiaobeiNeural', name: '晓北 (辽宁女声·幽默风趣)', language: 'zh-CN-liaoning', gender: 'Female', category: '中文方言 / 地方语言', description: '东北大碴子味幽默女声' },
  { voice_id: 'zh-CN-shaanxi-XiaoniNeural', name: '晓妮 (陕西女声·质朴地道)', language: 'zh-CN-shaanxi', gender: 'Female', category: '中文方言 / 地方语言', description: '地道陕西方言纯正女声' },
  { voice_id: 'zh-HK-HiuMaanNeural', name: '晓曼 (粤语女声·纯正自然)', language: 'zh-HK', gender: 'Female', category: '中文方言 / 地方语言', description: '纯正香港粤语自然女声' },
  { voice_id: 'zh-HK-HiuGaaiNeural', name: '晓佳 (粤语女声·亲和日常)', language: 'zh-HK', gender: 'Female', category: '中文方言 / 地方语言', description: '香港粤语日常温和女声' },
  { voice_id: 'zh-HK-WanLungNeural', name: '云龙 (粤语男声·沉稳儒雅)', language: 'zh-HK', gender: 'Male', category: '中文方言 / 地方语言', description: '纯正香港粤语商务男声' },
  { voice_id: 'zh-TW-HsiaoChenNeural', name: '晓臻 (台湾国语·温柔清新)', language: 'zh-TW', gender: 'Female', category: '中文方言 / 地方语言', description: '温和自然台湾国语' },
  { voice_id: 'zh-TW-HsiaoYuNeural', name: '晓雨 (台湾国语·知性亲切)', language: 'zh-TW', gender: 'Female', category: '中文方言 / 地方语言', description: '台湾普通话知性女声' },
  { voice_id: 'zh-TW-YunJheNeural', name: '云哲 (台湾男声·知性自然)', language: 'zh-TW', gender: 'Male', category: '中文方言 / 地方语言', description: '台湾普通话知性男声' },

  // 国际多语种 (支持中英文跨语言)
  { voice_id: 'en-US-AvaMultilingualNeural', name: 'Ava (美式女声·多语种支持)', language: 'en-US', gender: 'Female', category: '国际多语种 (支持中英文跨语言)', description: '支持中英文/多语言高自然度表达' },
  { voice_id: 'en-US-AndrewMultilingualNeural', name: 'Andrew (美式男声·多语种支持)', language: 'en-US', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '支持中英文/多语言沉稳自信表达' },
  { voice_id: 'en-US-EmmaMultilingualNeural', name: 'Emma (美式女声·自然亲和)', language: 'en-US', gender: 'Female', category: '国际多语种 (支持中英文跨语言)', description: '支持中英文多语种轻松日常表达' },
  { voice_id: 'en-US-BrianMultilingualNeural', name: 'Brian (美式男声·随和自然)', language: 'en-US', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '支持中英文多语种播讲解说' },
  { voice_id: 'de-DE-SeraphinaMultilingualNeural', name: 'Seraphina (德文女声·多语种支持)', language: 'de-DE', gender: 'Female', category: '国际多语种 (支持中英文跨语言)', description: '标准德语发音，支持中英文' },
  { voice_id: 'de-DE-FlorianMultilingualNeural', name: 'Florian (德文男声·多语种支持)', language: 'de-DE', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '标准德语发音，支持中英文' },
  { voice_id: 'fr-FR-VivienneMultilingualNeural', name: 'Vivienne (法文女声·多语种支持)', language: 'fr-FR', gender: 'Female', category: '国际多语种 (支持中英文跨语言)', description: '纯正法语浪漫优雅发音，支持中英文' },
  { voice_id: 'fr-FR-RemyMultilingualNeural', name: 'Remy (法文男声·多语种支持)', language: 'fr-FR', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '法语母语男声，支持中英文' },
  { voice_id: 'ko-KR-HyunsuMultilingualNeural', name: 'Hyunsu (韩文男声·多语种支持)', language: 'ko-KR', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '韩语沉稳男声，支持中英文' },
  { voice_id: 'it-IT-GiuseppeMultilingualNeural', name: 'Giuseppe (意文男声·多语种支持)', language: 'it-IT', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '意大利语发音，支持中英文' },
  { voice_id: 'ja-JP-NanamiNeural', name: '七海 (日文女声·Nanami)', language: 'ja-JP', gender: 'Female', category: '国际多语种 (支持中英文跨语言)', description: '日语温柔自然母语发音，支持汉字' },
  { voice_id: 'ja-JP-KeitaNeural', name: '圭太 (日文男声·Keita)', language: 'ja-JP', gender: 'Male', category: '国际多语种 (支持中英文跨语言)', description: '日语阳光自然男声，支持汉字' },

  // 纯正外语 (建议输入对应语种)
  { voice_id: 'en-US-JennyNeural', name: 'Jenny (美式女声·纯正英文)', language: 'en-US', gender: 'Female', category: '纯正外语 (建议输入对应语种)', description: '标准美式生活与商业对话（建议输入英文）' },
  { voice_id: 'en-US-GuyNeural', name: 'Guy (美式男声·纯正英文)', language: 'en-US', gender: 'Male', category: '纯正外语 (建议输入对应语种)', description: '标准美式商务与正式播报（建议输入英文）' },
  { voice_id: 'en-GB-SoniaNeural', name: 'Sonia (英式女声·纯正英伦)', language: 'en-GB', gender: 'Female', category: '纯正外语 (建议输入对应语种)', description: '优雅英伦腔发音（建议输入英文）' },
  { voice_id: 'ko-KR-SunHiNeural', name: '善姬 (韩文女声·标准韩语)', language: 'ko-KR', gender: 'Female', category: '纯正外语 (建议输入对应语种)', description: '标准韩语发音（建议输入韩文）' },
  { voice_id: 'ru-RU-SvetlanaNeural', name: 'Svetlana (俄文女声·流畅纯正)', language: 'ru-RU', gender: 'Female', category: '纯正外语 (建议输入对应语种)', description: '俄语母语自然发音（建议输入俄文）' },
];

export const XFYUN_VOICES: VoiceItem[] = [
  {
    voice_id: 'x4_xiaoyan',
    name: '讯飞小燕 (女声·标准新闻播报)',
    language: 'zh-CN',
    gender: 'Female',
    category: '科大讯飞官方精品',
    description: '央广播音质感，标准普通话，吐字清晰庄重大气',
  },
  {
    voice_id: 'x4_yezi',
    name: '讯飞小露 (女声·知性优雅解说)',
    language: 'zh-CN',
    gender: 'Female',
    category: '科大讯飞官方精品',
    description: '知性温婉，适合知识科普、影视旁白与有声文学',
  },
  {
    voice_id: 'aisjiuxu',
    name: '讯飞许久 (男声·深沉稳重解说)',
    language: 'zh-CN',
    gender: 'Male',
    category: '科大讯飞官方精品',
    description: '纪录片、政企宣传片专用磁性醇厚男声',
  },
  {
    voice_id: 'aisjinger',
    name: '讯飞小婧 (女声·清新生活日常)',
    language: 'zh-CN',
    gender: 'Female',
    category: '科大讯飞官方精品',
    description: '活泼自然，适合短视频生活陪伴与日常对话',
  },
  {
    voice_id: 'aisbabyxu',
    name: '讯飞许小宝 (童声·天真活泼故事)',
    language: 'zh-CN',
    gender: 'Male',
    category: '科大讯飞官方精品',
    description: '天真烂漫，亲子阅读与童话绘本首选音色',
  },
];


@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  public static readonly TTS_UNIT_COST = 20;
  public static readonly STT_UNIT_COST = 20;

  // 内置备用音色字典（在上游临时异常或未配置网络时保底）
  private cachedVoices: VoiceItem[] = [
    { voice_id: 'eve', name: 'Eve', language: 'multilingual' },
    { voice_id: 'ara', name: 'Ara', language: 'multilingual' },
    { voice_id: 'altair', name: 'Altair', language: 'multilingual' },
    { voice_id: 'atlas', name: 'Atlas', language: 'multilingual' },
    { voice_id: 'aurora', name: 'Aurora', language: 'multilingual' },
    { voice_id: 'carina', name: 'Carina', language: 'multilingual' },
    { voice_id: 'celeste', name: 'Celeste', language: 'multilingual' },
    { voice_id: 'cosmo', name: 'Cosmo', language: 'multilingual' },
    { voice_id: 'helios', name: 'Helios', language: 'multilingual' },
    { voice_id: 'leo', name: 'Leo', language: 'multilingual' },
    { voice_id: 'luna', name: 'Luna', language: 'multilingual' },
    { voice_id: 'orion', name: 'Orion', language: 'multilingual' },
    { voice_id: 'rex', name: 'Rex', language: 'multilingual' },
    { voice_id: 'sirius', name: 'Sirius', language: 'multilingual' },
    { voice_id: 'zenith', name: 'Zenith', language: 'multilingual' },
  ];

  constructor(
    @InjectRepository(VoiceTask)
    private readonly voiceTaskRepo: Repository<VoiceTask>,
    private readonly creditsService: CreditsService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 获取音频本地转存目录
   */
  public getUploadDir(): string {
    return path.resolve(process.cwd(), 'uploads', 'voice');
  }

  private getUpstreamConfig() {
    const baseUrl =
      this.configService.get<string>('GROK2API_BASE_URL') ||
      this.configService.get<string>('VOICE_API_BASE_URL') ||
      'http://1.15.171.111:8000/v1';
    const apiKey =
      this.configService.get<string>('GROK2API_KEY') ||
      this.configService.get<string>('GROK2API_API_KEY') ||
      this.configService.get<string>('VOICE_API_KEY');
    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
  }

  /**
   * 格式化 Edge-TTS 异常为友好中文提示，避免暴露 Python 堆栈
   */
  public formatEdgeTtsError(rawStderr: string): string {
    if (!rawStderr) {
      return '语音合成失败，请稍后重试';
    }
    if (rawStderr.includes('NoAudioReceived')) {
      return '所选发音人不支持当前语言文本（如外语发音人无法朗读中文），建议选择中文或多语种发音人';
    }
    if (
      rawStderr.includes('WSServerHandshakeError') ||
      rawStderr.includes('403') ||
      rawStderr.includes('Unauthorized')
    ) {
      return '微软语音网络通道暂时繁忙，请稍后重试';
    }
    const cleanLines = rawStderr
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.startsWith('File ') &&
          !l.startsWith('Traceback') &&
          !l.startsWith('sys.exit') &&
          !l.startsWith('During handling') &&
          !l.includes('in _run_tts') &&
          !l.includes('in amain'),
      );
    const lastLine = cleanLines.reverse().find((l) => !l.startsWith('^'));
    return lastLine
      ? lastLine.replace(/^edge_tts\.exceptions\.\w+:\s*/, '')
      : '语音合成引擎异常，请检查发音人与文本配置';
  }

  /**
   * 使用系统 edge-tts 引擎执行零成本神经网络语音合成
   */
  private async synthesizeWithEdgeTts(
    text: string,
    voiceId: string,
    speed: number,
    targetPath: string,
  ): Promise<void> {
    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateArg = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const chosenVoice =
      voiceId && voiceId.includes('Neural')
        ? voiceId
        : 'zh-CN-XiaoxiaoNeural';

    const executeOnce = (voiceToUse: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows ? 'edge-tts.exe' : 'edge-tts';
        const args = [
          '--text',
          text,
          '--voice',
          voiceToUse,
          '--rate',
          rateArg,
          '--write-media',
          targetPath,
        ];

        const child = spawn(cmd, args, {
          windowsHide: true,
          shell: false,
        });

        let stderr = '';
        child.stderr.on('data', (d) => {
          stderr += d.toString();
        });

        child.on('error', (err) => {
          this.logger.warn(
            `直接执行 ${cmd} 失败: ${err.message}，尝试使用 Python 模块通道执行...`,
          );
          const pyCmd = isWindows ? 'python' : 'python3';
          const pyArgs = ['-m', 'edge_tts', ...args];
          const pyChild = spawn(pyCmd, pyArgs, { windowsHide: true });
          let pyStderr = '';
          pyChild.stderr.on('data', (d) => {
            pyStderr += d.toString();
          });
          pyChild.on('error', (pyErr) => {
            reject(new Error(`无法启动 edge-tts 引擎: ${pyErr.message}`));
          });
          pyChild.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(this.formatEdgeTtsError(pyStderr)));
          });
        });

        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(this.formatEdgeTtsError(stderr)));
        });
      });
    };

    try {
      await executeOnce(chosenVoice);
    } catch (err: any) {
      // 智能自愈：若当前所选非中文发音人因不支持汉字抛出异常，且文本中包含中文字符，自动降级至默认晓晓重试
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);
      const isVoiceMismatch =
        err.message.includes('不支持当前语言文本') ||
        err.message.includes('NoAudioReceived');

      if (chosenVoice !== 'zh-CN-XiaoxiaoNeural' && hasChinese && isVoiceMismatch) {
        this.logger.warn(
          `发音人 ${chosenVoice} 无法朗读中文文本，自动降级至默认精品普通话发音人 (zh-CN-XiaoxiaoNeural) 重试`,
        );
        await executeOnce('zh-CN-XiaoxiaoNeural');
        return;
      }
      throw err;
    }
  }

  /**
   * 获取可用音色列表
   */

  /**
   * 使用科大讯飞在线高保真语音合成 (TTS)
   */
  private async synthesizeWithXfyunTts(
    text: string,
    voiceId: string,
    speed: number,
    targetPath: string,
  ): Promise<void> {
    const APPID = this.configService.get<string>('XFYUN_APPID') || '49a48188';
    const APISecret =
      this.configService.get<string>('XFYUN_API_SECRET') ||
      'ZGZmMWY1ODFlN2E2M2Y1NzlmODFiZWE4';
    const APIKey =
      this.configService.get<string>('XFYUN_API_KEY') ||
      '5135581869d8f6d5d054e4a208a35040';

    const vcn = voiceId && voiceId !== 'default' ? voiceId : 'x4_xiaoyan';
    const host = 'tts-api.xfyun.cn';
    const date = new Date().toUTCString();
    const requestLine = 'GET /v2/tts HTTP/1.1';
    const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
    const signature = crypto
      .createHmac('sha256', APISecret)
      .update(signatureOrigin)
      .digest('base64');
    const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    const url = `wss://${host}/v2/tts?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;

    const speedVal = Math.max(0, Math.min(100, Math.round(speed * 50)));

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const audioChunks: Buffer[] = [];

      ws.onopen = () => {
        const payload = {
          common: { app_id: APPID },
          business: {
            aue: 'lame',
            sfl: 1,
            auf: 'audio/L16;rate=16000',
            vcn,
            speed: speedVal,
            volume: 50,
            pitch: 50,
            bgs: 0,
            tte: 'UTF8',
          },
          data: {
            status: 2,
            text: Buffer.from(text).toString('base64'),
          },
        };
        ws.send(JSON.stringify(payload));
      };

      ws.onmessage = async (event) => {
        try {
          const res = JSON.parse(event.data);
          if (res.code !== 0) {
            ws.close();
            return reject(
              new Error(`科大讯飞语音合成错误 (${res.code}): ${res.message}`),
            );
          }
          if (res.data?.audio) {
            audioChunks.push(Buffer.from(res.data.audio, 'base64'));
          }
          if (res.data?.status === 2) {
            const buffer = Buffer.concat(audioChunks);
            await fs.writeFile(targetPath, buffer);
            ws.close();
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      };

      ws.onerror = (err) => reject(err);

      setTimeout(() => {
        ws.close();
        reject(new Error('科大讯飞语音合成服务响应超时'));
      }, 20000);
    });
  }

  /**
   * 使用科大讯飞流式听写 IAT 执行语音识别
   */
  private async transcribeWithXfyunIat(
    fileBuffer: Buffer,
    originalExt: string,
  ): Promise<string> {
    const APPID = this.configService.get<string>('XFYUN_APPID') || '49a48188';
    const APISecret =
      this.configService.get<string>('XFYUN_API_SECRET') ||
      'ZGZmMWY1ODFlN2E2M2Y1NzlmODFiZWE4';
    const APIKey =
      this.configService.get<string>('XFYUN_API_KEY') ||
      '5135581869d8f6d5d054e4a208a35040';

    const uploadDir = this.getUploadDir();
    const tempInput = path.join(
      uploadDir,
      `iat_in_${Date.now()}_${Math.random().toString(36).slice(2)}.${originalExt}`,
    );
    const tempPcm = path.join(
      uploadDir,
      `iat_out_${Date.now()}_${Math.random().toString(36).slice(2)}.pcm`,
    );
    await fs.writeFile(tempInput, fileBuffer);

    try {
      await new Promise<void>((resolve, reject) => {
        const ff = spawn('ffmpeg', [
          '-y',
          '-i',
          tempInput,
          '-f',
          's16le',
          '-acodec',
          'pcm_s16le',
          '-ar',
          '16000',
          '-ac',
          '1',
          tempPcm,
        ]);
        ff.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg 转码失败 (code ${code})`));
        });
        ff.on('error', (err) => reject(err));
      });

      const pcmBuffer = await fs.readFile(tempPcm);
      if (pcmBuffer.length === 0) {
        throw new Error('转换后的 PCM 音频数据为空');
      }

      const host = 'iat-api.xfyun.cn';
      const date = new Date().toUTCString();
      const requestLine = 'GET /v2/iat HTTP/1.1';
      const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;
      const signature = crypto
        .createHmac('sha256', APISecret)
        .update(signatureOrigin)
        .digest('base64');
      const authorizationOrigin = `api_key="${APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
      const authorization = Buffer.from(authorizationOrigin).toString('base64');
      const url = `wss://${host}/v2/iat?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`;

      return await new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(url);
        let transcribedText = '';

        ws.onopen = () => {
          const FRAME_SIZE = 1280;
          let offset = 0;
          const interval = setInterval(() => {
            if (offset >= pcmBuffer.length) {
              clearInterval(interval);
              try {
                ws.send(
                  JSON.stringify({
                    data: {
                      status: 2,
                      format: 'audio/L16;rate=16000',
                      encoding: 'raw',
                      audio: '',
                    },
                  }),
                );
              } catch (_) {}
              return;
            }

            const chunk = pcmBuffer.subarray(offset, offset + FRAME_SIZE);
            const isFirst = offset === 0;
            offset += FRAME_SIZE;
            const isLast = offset >= pcmBuffer.length;

            const frame: any = {
              data: {
                status: isFirst ? 0 : isLast ? 2 : 1,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: chunk.toString('base64'),
              },
            };

            if (isFirst) {
              frame.common = { app_id: APPID };
              frame.business = {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                vad_eos: 5000,
                dwa: 'wpgs',
              };
            }

            try {
              ws.send(JSON.stringify(frame));
            } catch (err) {
              clearInterval(interval);
              reject(err);
            }
          }, 40);
        };

        ws.onmessage = (event) => {
          try {
            const res = JSON.parse(event.data);
            if (res.code !== 0) {
              ws.close();
              return reject(
                new Error(`讯飞语音听写错误 (${res.code}): ${res.message}`),
              );
            }
            if (res.data?.result?.ws) {
              for (const w of res.data.result.ws) {
                for (const cw of w.cw) {
                  transcribedText += cw.w;
                }
              }
            }
            if (res.data?.status === 2) {
              ws.close();
              resolve(transcribedText.trim() || '未识别到清晰语音内容');
            }
          } catch (e) {
            reject(e);
          }
        };

        ws.onerror = (err) => reject(err);
        setTimeout(() => {
          ws.close();
          reject(new Error('科大讯飞语音听写服务响应超时'));
        }, 30000);
      });
    } finally {
      await fs.unlink(tempInput).catch(() => {});
      await fs.unlink(tempPcm).catch(() => {});
    }
  }

  async getVoices(model?: string): Promise<{ voices: VoiceItem[] }> {
    if (model === 'xfyun-tts' || model?.startsWith('xfyun')) {
      return { voices: XFYUN_VOICES };
    }
    // 默认或指定 edge-tts 时，返回 30+ 官方精品神经音色库
    if (!model || model === 'edge-tts') {
      return { voices: EDGE_VOICES };
    }

    try {
      const { baseUrl, apiKey } = this.getUpstreamConfig();
      const url = `${baseUrl}/tts/voices?model=${encodeURIComponent(model)}`;
      const res = await fetch(url, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(1500),
      });

      if (res.ok) {
        const data = (await res.json()) as { voices?: VoiceItem[] };
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          this.cachedVoices = data.voices;
          return { voices: this.cachedVoices };
        }
      }
    } catch (err) {
      this.logger.warn(`获取上游音色列表失败，回退缓存字典: ${err}`);
    }
    return { voices: this.cachedVoices };
  }

  /**
   * 提交 TTS 文本转语音任务
   */
  async createTts(userId: string, dto: CreateTtsDto): Promise<VoiceTask> {
    const model = dto.model || 'edge-tts';
    const isEdgeTts = model === 'edge-tts';
    const isXfyunTts = model === 'xfyun-tts' || model.startsWith('xfyun');
    const costCredits = isEdgeTts || isXfyunTts ? 1 : VoiceService.TTS_UNIT_COST;
    const speed = dto.speed || 1.0;
    const language = dto.language || 'zh';
    const voiceId = isEdgeTts
      ? dto.voiceId && dto.voiceId.includes('Neural')
        ? dto.voiceId
        : 'zh-CN-XiaoxiaoNeural'
      : isXfyunTts
        ? dto.voiceId || 'x4_xiaoyan'
        : dto.voiceId || 'eve';

    // 1. 初始化并持久化任务记录 (状态: pending)
    const task = this.voiceTaskRepo.create({
      userId,
      type: 'tts',
      model,
      voiceId,
      language,
      speed,
      text: dto.text,
      costCredits,
      status: 'pending',
    });
    const savedTask = await this.voiceTaskRepo.save(task);

    // 2. 扣减积分 (Edge-TTS 仅扣 1 积分防刷，Grok 扣 20 积分)
    await this.creditsService.deductDirectCredits({
      userId,
      amount: costCredits,
      businessType: CreditBusinessType.VOICE_TTS,
      businessId: savedTask.id,
      modelId: model,
      remark: `语音合成：${dto.text.slice(0, 30)}`,
    });

    const uploadDir = this.getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `tts_${savedTask.id}.mp3`;
    const targetPath = path.join(uploadDir, filename);

    try {
      if (isEdgeTts) {
        // 使用 Edge-TTS 高保真神经语音合成
        await this.synthesizeWithEdgeTts(dto.text, voiceId, speed, targetPath);
        const stats = await fs.stat(targetPath);
        if (stats.size === 0) {
          throw new Error('Edge-TTS 合成音频大小为 0 字节');
        }
      } else if (isXfyunTts) {
        // 使用科大讯飞高保真在线语音合成
        await this.synthesizeWithXfyunTts(dto.text, voiceId, speed, targetPath);
        const stats = await fs.stat(targetPath);
        if (stats.size === 0) {
          throw new Error('科大讯飞语音合成音频大小为 0 字节');
        }
      } else {
        // 3. 调用上游 Grok TTS 接口
        const { baseUrl, apiKey } = this.getUpstreamConfig();
        const upstreamUrl = `${baseUrl}/tts`;

        const response = await fetch(upstreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(35000),
          body: JSON.stringify({
            model,
            text: dto.text,
            voice_id: voiceId,
            language,
            speed,
            output_format: { codec: 'mp3' },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 429 || errText.includes('quota_exhausted')) {
            throw new Error('上游语音账号额度已耗尽，正在排队恢复，请稍后再试');
          }
          if (
            response.status === 503 ||
            errText.includes('upstream_unavailable')
          ) {
            throw new Error('上游语音通道暂时不可用，请稍后再试');
          }
          throw new Error(`上游语音合成异常 (${response.status}): ${errText}`);
        }

        // 4. 读取音频二进制流并本地落盘
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.byteLength === 0) {
          throw new Error('上游返回音频数据为空');
        }

        await fs.writeFile(targetPath, buffer);
      }

      // 5. 更新任务状态为成功
      savedTask.status = 'success';
      savedTask.audioUrl = `/voice/media/${filename}`;
      return await this.voiceTaskRepo.save(savedTask);
    } catch (error) {
      const isTimeout =
        (error instanceof Error && error.name === 'TimeoutError') ||
        String(error).includes('TimeoutError');
      const rawMsg = error instanceof Error ? error.message : String(error);
      const msg = isTimeout
        ? '语音生成响应超时，已全额退还积分'
        : isEdgeTts
          ? this.formatEdgeTtsError(rawMsg)
          : rawMsg;
      this.logger.error(`TTS 语音合成失败: ${msg}`);

      // 标记失败
      savedTask.status = 'failed';
      savedTask.errorMessage = msg;
      await this.voiceTaskRepo.save(savedTask);

      // 全额退款
      await this.creditsService.refundDirectCredits({
        userId,
        amount: costCredits,
        businessType: CreditBusinessType.VOICE_TTS,
        businessId: savedTask.id,
        modelId: model,
        remark: `语音合成失败退款：${msg.slice(0, 50)}`,
      });

      throw new BadRequestException(`语音合成失败: ${msg}`);
    }
  }

  /**
   * 提交 STT 语音识别转文字任务
   */
  async createStt(
    userId: string,
    file: Express.Multer.File,
    language?: string,
    model?: string,
  ): Promise<VoiceTask> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('请上传有效的音频文件');
    }

    const sttModel = model || 'grok-stt';
    const isXfyunIat = sttModel === 'xfyun-iat' || sttModel.startsWith('xfyun');
    const lang = language || 'zh';
    const costCredits = isXfyunIat ? 1 : VoiceService.STT_UNIT_COST;

    // 1. 初始化并持久化任务记录 (状态: pending)
    const task = this.voiceTaskRepo.create({
      userId,
      type: 'stt',
      model: sttModel,
      language: lang,
      speed: 1.0,
      text: '', // 待识别填入
      costCredits,
      status: 'pending',
    });
    const savedTask = await this.voiceTaskRepo.save(task);

    // 2. 扣除 20 积分
    await this.creditsService.deductDirectCredits({
      userId,
      amount: costCredits,
      businessType: CreditBusinessType.VOICE_STT,
      businessId: savedTask.id,
      modelId: sttModel,
      remark: '语音识别转文字',
    });

    try {
      // 3. 转存用户上传的原音频文件，便于前端复听
      const extMatch = file.originalname?.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
      const uploadDir = this.getUploadDir();
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `stt_${savedTask.id}.${ext}`;
      const targetPath = path.join(uploadDir, filename);
      await fs.writeFile(targetPath, file.buffer);
      savedTask.audioUrl = `/voice/media/${filename}`;

      // 4. 调用上游 STT 接口
      const { baseUrl, apiKey } = this.getUpstreamConfig();
      const upstreamUrl = `${baseUrl}/stt`;

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'audio/mpeg' }),
        file.originalname || `audio.${ext}`,
      );
      formData.append('model', sttModel);
      formData.append('language', lang);

      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`上游语音识别异常 (${response.status}): ${errText}`);
      }

      const result = (await response.json()) as {
        text?: string;
        duration?: number;
      };

      const recognizedText = result.text?.trim() || '';
      savedTask.status = 'success';
      savedTask.text = recognizedText;
      savedTask.duration = result.duration || null;
      return await this.voiceTaskRepo.save(savedTask);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`STT 语音识别失败: ${msg}`);

      savedTask.status = 'failed';
      savedTask.errorMessage = msg;
      await this.voiceTaskRepo.save(savedTask);

      // 全额退款
      await this.creditsService.refundDirectCredits({
        userId,
        amount: costCredits,
        businessType: CreditBusinessType.VOICE_STT,
        businessId: savedTask.id,
        modelId: sttModel,
        remark: `语音识别失败退款：${msg.slice(0, 50)}`,
      });

      throw new BadRequestException(`语音识别失败: ${msg}`);
    }
  }

  /**
   * 分页查询当前用户的语音历史任务
   */
  async getHistory(
    userId: string,
    query: QueryVoiceHistoryDto,
  ): Promise<{
    items: VoiceTask[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(Math.max(1, query.pageSize || 20), 50);
    const skip = (page - 1) * pageSize;

    const qb = this.voiceTaskRepo.createQueryBuilder('task');
    qb.where('task.userId = :userId', { userId });

    if (query.type && query.type !== 'all') {
      qb.andWhere('task.type = :type', { type: query.type });
    }

    qb.orderBy('task.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * 安全获取本地音频文件物理路径
   */
  async getMediaFilePath(filename: string): Promise<string> {
    if (!/^[a-zA-Z0-9_.-]+\.(mp3|wav|m4a|webm|ogg|aac)$/i.test(filename)) {
      throw new BadRequestException('非法的音频文件名');
    }

    const filePath = path.join(this.getUploadDir(), filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw new NotFoundException('请求的音频文件不存在');
    }
  }
}
