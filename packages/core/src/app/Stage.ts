import {Scene} from '../scenes';
import {unwrap} from '../signals';
import type {Color} from '../types';
import {CanvasColorSpace, Vector2} from '../types';
import {getContext} from '../utils';
import {MoblurRenderer} from './MoblurRenderer';

export interface StageSettings {
  size: Vector2;
  motionBlur: number;
  resolutionScale: number;
  colorSpace: CanvasColorSpace;
  background: Color | string | null;
}

/**
 * Manages canvases on which an animation can be displayed.
 */
export class Stage {
  // TODO Consider adding pooling for canvases.

  private background: string | null = null;
  private resolutionScale = 1;
  private colorSpace: CanvasColorSpace = 'srgb';
  private size = Vector2.zero;
  private motionBlurSamples = 1;

  public readonly finalBuffer: HTMLCanvasElement;
  private readonly currentBuffer: HTMLCanvasElement;
  private readonly previousBuffer: HTMLCanvasElement;
  private moblurRenderer: MoblurRenderer | null = null;

  private context: CanvasRenderingContext2D;
  private currentContext: CanvasRenderingContext2D;
  private previousContext: CanvasRenderingContext2D;

  private get canvasSize() {
    return this.size.scale(this.resolutionScale);
  }

  public constructor() {
    this.finalBuffer = document.createElement('canvas');
    this.currentBuffer = document.createElement('canvas');
    this.previousBuffer = document.createElement('canvas');

    const colorSpace = this.colorSpace;
    this.context = getContext({colorSpace}, this.finalBuffer);
    this.currentContext = getContext({colorSpace}, this.currentBuffer);
    this.previousContext = getContext({colorSpace}, this.previousBuffer);
  }

  public configure({
    colorSpace = this.colorSpace,
    size = this.size,
    resolutionScale = this.resolutionScale,
    motionBlur = this.motionBlurSamples,
    background = this.background,
  }: Partial<StageSettings>) {
    if (colorSpace !== this.colorSpace) {
      this.colorSpace = colorSpace;
      this.context = getContext({colorSpace}, this.finalBuffer);
      this.currentContext = getContext({colorSpace}, this.currentBuffer);
      this.previousContext = getContext({colorSpace}, this.previousBuffer);
    }

    if (
      !size.exactlyEquals(this.size) ||
      resolutionScale !== this.resolutionScale
    ) {
      this.resolutionScale = resolutionScale;
      this.size = size;
      this.resizeCanvas(this.context);
      this.resizeCanvas(this.currentContext);
      this.resizeCanvas(this.previousContext);
    }

    console.log('Configured');

    console.log('Values', motionBlur, !MoblurRenderer.checkSupport());

    if (motionBlur <= 1 || !MoblurRenderer.checkSupport()) {
      console.log('Moblur cleared');
      this.moblurRenderer = null;
    } else if (!this.moblurRenderer) {
      console.log('Moblur setup');
      this.moblurRenderer = new MoblurRenderer(this.size, motionBlur);
    }

    this.background =
      typeof background === 'string'
        ? background
        : background?.serialize() ?? null;

    if (this.moblurRenderer) {
      console.log('Moblur changed');
      this.moblurRenderer.resize(this.size);
      this.moblurRenderer.setSamples(motionBlur);
    }
  }

  private async renderScene(scene: Scene, context: CanvasRenderingContext2D) {
    if (this.moblurRenderer) {
      await this.moblurRenderer.render(scene, context);
    } else {
      await scene.render(context);
    }
  }

  public async render(currentScene: Scene, previousScene: Scene | null) {
    const previousOnTop = previousScene
      ? unwrap(currentScene.previousOnTop)
      : false;

    if (previousScene) {
      await this.renderScene(previousScene, this.previousContext);
    }

    await this.renderScene(currentScene, this.currentContext);

    const size = this.canvasSize;
    this.context.clearRect(0, 0, size.width, size.height);
    if (this.background) {
      this.context.save();
      this.context.fillStyle = this.background;
      this.context.fillRect(0, 0, size.width, size.height);
      this.context.restore();
    }

    if (previousScene && !previousOnTop) {
      this.context.drawImage(this.previousBuffer, 0, 0);
    }
    this.context.drawImage(this.currentBuffer, 0, 0);
    if (previousOnTop) {
      this.context.drawImage(this.previousBuffer, 0, 0);
    }
  }

  public resizeCanvas(context: {canvas: {width: number; height: number}}) {
    const size = this.canvasSize;
    context.canvas.width = size.width;
    context.canvas.height = size.height;
  }
}
