#pragma once

#include <functional>
#include <tuple>


// helpers for tuple unrolling
template<int ...> struct seq {};
template<int N, int ...S> struct gens : gens<N-1, N-1, S...> {};
template<int ...S> struct gens<0, S...>{ typedef seq<S...> type; };

// invocation helper
template<typename FN, typename P, int ...S>
void call_fn_internal(FN fn, P& params, const seq<S...>)
{
   fn(std::get<S>(params) ...);
}
// call function with arguments stored in std::tuple
template<typename Func, typename ...Args>
void call_fn(Func fn,
            std::tuple<Args...>& params)
{
    call_fn_internal(fn, params, typename gens<sizeof...(Args)>::type());
}

//================================================================================

class DeclarativeInterface {
public:
        virtual ~DeclarativeInterface() {}
  virtual void operator()() = 0;
};

//template <class SIGNATURE> class Declarative;
template <class Func, class... Args>
class Declarative : public DeclarativeInterface {
public:
  //Declarative(const Declarative &) = delete;
  //void operator=(const Declarative &) = delete;
  //Declarative() {}
  virtual ~Declarative() {}

  // void assign(Ret(*function)(Args...), Args... args) {
  //   //this->fn = std::bind(std::forward<FUNCTION>(function), args...);
  //   //fn = std::forward<Ret(Args...)>(function);
  //   _func = function;
  //   _params = std::make_tuple(args...);
  // }

  Declarative(Func func, Args... args) : _func{func}, _params{args...} {
  }
  virtual void operator()() {
    call_fn(_func, _params);
  }

  Func _func;
  //std::function<Func> _func;
  std::tuple<Args...> _params;
};
