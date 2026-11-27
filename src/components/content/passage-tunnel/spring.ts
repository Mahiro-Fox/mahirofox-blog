/**
 * 二阶弹簧（临界阻尼）。
 *
 * 相机姿态、悬停强度、大图张开度全都走这一个积分器：给定固有周期 period，
 * 角频率 omega = 2π/period，用 1/120 的固定子步积分，保证不同帧率下手感一致。
 *
 * 返回值表示「还在动」，渲染循环据此决定是否继续请求下一帧（静止时省电）。
 */
export interface Spring {
  value: number;
  velocity: number;
}

export function createSpring(value = 0): Spring {
  return { value, velocity: 0 };
}

const SUB_STEP = 1 / 120;

export function stepSpring(
  spring: Spring,
  target: number,
  dt: number,
  period: number
): boolean {
  const omega = (Math.PI * 2) / Math.max(period, 0.02);
  const steps = Math.max(1, Math.ceil(dt / SUB_STEP));
  const step = dt / steps;

  for (let i = 0; i < steps; i += 1) {
    const acceleration =
      omega * omega * (target - spring.value) - 2 * omega * spring.velocity;
    spring.velocity += acceleration * step;
    spring.value += spring.velocity * step;
  }

  return (
    Math.abs(target - spring.value) > 1e-4 || Math.abs(spring.velocity) > 1e-4
  );
}

export function resetSpring(spring: Spring, value = 0): void {
  spring.value = value;
  spring.velocity = 0;
}
