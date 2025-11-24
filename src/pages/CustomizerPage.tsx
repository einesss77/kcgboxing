import { useNavigate } from 'react-router-dom';
import GloveViewer from '../components/GloveViewer';
import ColorSelector from '../components/customizer/ColorSelector';
import TextCustomization from '../components/customizer/TextCustomization';
import ImageUploader from '../components/customizer/ImageUploader';
import SizeSelector from '../components/customizer/SizeSelector';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { useCustomizationStore } from '../store/customizationStore';
import { useCartStore } from '../store/cartStore';

export default function CustomizerPage() {
  const { addCartItem } = useCartStore();
  const navigate = useNavigate();
  const { currentTab, setCurrentTab, nextTab, prevTab, resetCustomization } = useCustomizationStore();
  // Define tab order for navigation
  const tabsOrder = ['colors', 'materials', 'size', 'text', 'images'];
  const currentIndex = tabsOrder.indexOf(currentTab);
  const isFirstTab = currentIndex === 0;
  const isLastTab = currentIndex === tabsOrder.length - 1;

  const handleAddToCart = () => {
    const { glove, textZones, customImages, calculatePrice } = useCustomizationStore.getState();

    const item = {
      id: crypto.randomUUID(),
      glove: {
        size: glove.size || '12oz',
        fingersColor: glove.fingersColor || { name: 'Default', hex: '#000', price: 0 },
        outerPalmColor: glove.outerPalmColor || { name: 'Default', hex: '#000', price: 0 },
        innerPalmColor: glove.innerPalmColor || { name: 'Default', hex: '#000', price: 0 },
        innerThumbColor: glove.innerThumbColor || { name: 'Default', hex: '#000', price: 0 },
        outerThumbColor: glove.outerThumbColor || { name: 'Default', hex: '#000', price: 0 },
        strapColor: glove.strapColor || { name: 'Default', hex: '#000', price: 0 },
        wristColor: glove.wristColor || { name: 'Default', hex: '#000', price: 0 },
        wristOutlineColor: glove.wristOutlineColor || { name: 'Default', hex: '#000', price: 0 },
        outlineColor: glove.outlineColor || { name: 'Default', hex: '#000', price: 0 },
        material: glove.material || { name: 'Standard', description: 'Default Material', price: 0 },
      },
      textZones,
      customImages,
      price: Number(calculatePrice()),
      quantity: 1,
    };

    console.log("🧤 Objet ajouté au panier :", JSON.stringify(item, null, 2));
    addCartItem(item);
    alert('✅ Glove added to cart !');
    navigate('/cart');
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-screen pt-20 overflow-hidden">
      <div className="w-full lg:w-1/2 h-1/2 lg:h-full bg-neutral-900">
        <GloveViewer />
      </div>

      <div className="w-full lg:w-1/2 h-1/2 lg:h-full overflow-y-auto px-6 py-8 bg-neutral-950 border-l border-neutral-800">
        <Tabs value={currentTab} onChange={setCurrentTab} defaultValue="colors" className="w-full">
          {/* Top Navigation with Tabs */}
          <div className="flex items-center gap-4 mb-6">
            {/* Previous Button (Left) - Hidden on first page */}
            {!isFirstTab && (
              <button
                onClick={prevTab}
                className="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all bg-neutral-700 text-white hover:bg-neutral-600"
              >
                ← Previous
              </button>
            )}

            {/* Tab Headers (Center) */}
            <TabsList className="flex gap-2 flex-wrap flex-1 justify-center">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="size">Size</TabsTrigger>
              <TabsTrigger value="text">Custom Text</TabsTrigger>
              <TabsTrigger value="images">Custom Image</TabsTrigger>
            </TabsList>
            {/* Next Button (Right) - Hidden on last page */}
            {!isLastTab && (
              <button
                onClick={nextTab}
                className="py-2.5 px-4 rounded-lg font-semibold text-sm transition-all bg-gold text-navy hover:bg-yellow-400"
              >
                Next →
              </button>
            )}
          </div>

          <TabsContent value="colors">
            <ColorSelector />
          </TabsContent>

          <TabsContent value="materials">
            <div className="space-y-4 text-neutral-300">
              <h4 className="text-xl font-semibold text-white">How Our Gloves Are Made</h4>
              <p>
                Our gloves are crafted from premium-grade leather, carefully selected for durability, flexibility,
                and comfort. Each glove is hand-cut and expertly stitched to ensure a perfect anatomical fit and long-lasting performance.
              </p>
              <p>
                Inside, the gloves are lined with breathable moisture-wicking fabric to keep your hands cool and dry.
                Multi-layered high-density foam provides unmatched shock absorption while protecting your knuckles and wrists.
              </p>
              <p>
                Combining traditional craftsmanship with cutting-edge design, our gloves are battle-tested and built to perform.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="size">
            <SizeSelector />
          </TabsContent>

          <TabsContent value="text">
            <TextCustomization />
          </TabsContent>

          <TabsContent value="images">
            <ImageUploader />
          </TabsContent>
        </Tabs>
        {/* Bottom Navigation Buttons - Hidden on first/last pages */}
        <div className="mt-6 flex justify-between gap-4">
          {!isFirstTab && (
            <button
              onClick={prevTab}
              className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all bg-neutral-700 text-white hover:bg-neutral-600"
            >
              ← Previous
            </button>
          )}
          {!isLastTab && (
            <button
              onClick={nextTab}
              className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all bg-gold text-navy hover:bg-yellow-400"
            >
              Next →
            </button>
          )}
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={resetCustomization}
            className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-lg transition"
          >
            🔄 Reset Colors to White
          </button>

          <button
            onClick={handleAddToCart}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-3 rounded-lg font-bold text-lg transition"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
