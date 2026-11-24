// 여러 파일로 나눈 메서드를 한 클래스에 붙인다. getter 도 그대로 옮기기 위해 속성 설명자를 복사한다
export function applyMixins(target, ...sources) {
  for (const src of sources) {
    const descriptors = Object.getOwnPropertyDescriptors(src.prototype);
    delete descriptors.constructor;
    Object.defineProperties(target.prototype, descriptors);
  }
}
